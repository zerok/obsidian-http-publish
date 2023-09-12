import { App, Editor, MarkdownFileInfo, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';
import { DEFAULT_SETTINGS, DestinationSettings, HTTPPublishPluginSettings } from 'src/settings';

interface ServerPublishResponse {
	path: string,
}

export default class HTTPPublishPlugin extends Plugin {
	settings: HTTPPublishPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'http-publish',
			name: 'HTTP Publish',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const mdFile = this.app.workspace.activeEditor;
				if (!mdFile) {
					alert('No file active');
					return;
				}
				if (this.settings.destinations.length < 1) {
					alert('Please set up a destination first in the settings.')
					return;
				}
				// If there's more one destination defined, then the user needs
				// to pick the preferred one from a modal:
				if (this.settings.destinations.length > 1) {
					new DestinationPicker(this.app, this, mdFile).open();
					return;
				}
				try {
					const response = await this.publishFile(this.settings.destinations[0].name!, mdFile);
					await this.updateFileFromResponse(mdFile, response);
				} catch (e) {
					new Notice('Failed to send note to destination');
					console.log(e);
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	async updateFileFromResponse(file: MarkdownFileInfo, serverInfo: ServerPublishResponse) {
		const editor = this.app.workspace.activeEditor?.editor!;
		// TODO: Check if there is a metadata field aleady for the path
		// We know that the first line starts the frontmatter.
		editor.replaceRange(`path: ${serverInfo.path}\n`, {
			ch: 0, line: 1,
		}, {
			ch: 0, line: 1,
		});
		new Notice("Note successfully published");
	}

	async publishFile(destName: string, file: MarkdownFileInfo) {
		console.log(`Publishing ${file.file?.path} to ${destName}`);
		const dest = this.settings.destinations.filter(dest => dest.name === destName).first();
		if (!dest) {
			throw new Error('No destination available');
		}
		const fileContent = await this.app.vault.cachedRead(file.file!);
		const headers: Record<string, string> = {
			'Content-Type': 'text/markdown',
		};
		if (dest.authHeaderName) {
			headers[dest.authHeaderName!] = dest.authHeaderValue || '';
		}
		return requestUrl({
			url: dest.url!,
			method: 'POST',
			body: fileContent,
			headers: headers,
		}).json;
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class DestinationPicker extends Modal {
	plugin: HTTPPublishPlugin
	file: MarkdownFileInfo

	constructor(app: App, plugin: HTTPPublishPlugin, mdFile: MarkdownFileInfo) {
		super(app);
		this.plugin = plugin;
		this.file = mdFile;
	}

	onOpen(): void {
		const {contentEl} = this;
		let pickedDestination: string|null = null;

		new Setting(contentEl).setHeading().setName('Pick a destination');
		new Setting(contentEl).setName('Destination').addDropdown((dropDown) => {
			for (const dest of this.plugin.settings.destinations) {
				dropDown.addOption(dest.name!, dest.name!);
			}
			pickedDestination = dropDown.getValue();
			dropDown.onChange((val) => {
				pickedDestination = val;
			})
		});
		new Setting(contentEl).addButton(button => {
			button.setButtonText('Send').onClick(async () => {
				if (!pickedDestination) {
					return;
				}
				try {
					const response = await this.plugin.publishFile(pickedDestination, this.file);
					await this.plugin.updateFileFromResponse(this.file, response);
				} catch (e) {
					this.close();
					new Notice('Failed to send data to destination');
				}
			});
		});
	}
}

class SettingTab extends PluginSettingTab {
	plugin: HTTPPublishPlugin;
	newDestination: DestinationSettings;

	constructor(app: App, plugin: HTTPPublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.newDestination = new DestinationSettings();
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl).setName("Destinations").setHeading();
		if (this.plugin.settings.destinations.length <= 0) {
			new Setting(containerEl).setName("No destinations set yet.")
		} else {
			for (const dest of this.plugin.settings.destinations) {
				(destination => {
					new Setting(containerEl)
						.setName(destination.name || '')
						.setDesc(destination.url || '')
						.addButton(btn => {
							btn.setButtonText("delete").onClick(async () => {
								this.plugin.settings.destinations = this.plugin.settings.destinations.filter(d => {
									return d.name !== destination.name;
								});
								await this.plugin.saveSettings();
								this.display();
							})
						});
				})(dest);
			}
		}

		new Setting(containerEl)
			.setName("Add new destination")
			.setHeading()
			.setDesc("A destination is a single HTTP endpoint that you want to send data to.");

		new Setting(containerEl)
			.setName("Name")
			.addText(comp => {
				comp.setPlaceholder("default").onChange((v) => {
					this.newDestination = new DestinationSettings(v, this.newDestination.url, this.newDestination.authHeaderName, this.newDestination.authHeaderValue);
				}).setValue(this.newDestination.name || '');
			});
		new Setting(containerEl)
			.setName("URL")
			.addText(comp => {
				comp.setPlaceholder("https://example.org").onChange((v) => {
					this.newDestination = new DestinationSettings(this.newDestination.name, v, this.newDestination.authHeaderName, this.newDestination.authHeaderValue);
				}).setValue(this.newDestination.url || '');
			});
		new Setting(containerEl)
			.setName("Authorization header name")
			.addText(comp => {
				comp.setPlaceholder("Authorization").onChange((v) => {
					this.newDestination = new DestinationSettings(this.newDestination.name, this.newDestination.url, v, this.newDestination.authHeaderValue);
				}).setValue(this.newDestination.authHeaderName || '');
			});
		new Setting(containerEl)
			.setName("Authorization header value")
			.addText(comp => {
				comp.setPlaceholder("Bearer 12345").onChange((v) => {
					this.newDestination = new DestinationSettings(this.newDestination.name, this.newDestination.url, this.newDestination.authHeaderName, v);
				}).setValue(this.newDestination.authHeaderValue || '');
			});
		new Setting(containerEl).addButton(button => {
			button.setButtonText("Add destination").onClick(async (evt) => {
				try {
					this.newDestination.validate();
				} catch(e) {
					new Notice(e.message);
					return;
				}
				this.plugin.settings.destinations.push(this.newDestination);
				this.newDestination = new DestinationSettings();
				await this.plugin.saveSettings();
				this.display();
			});
		})
	}
}
