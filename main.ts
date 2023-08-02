import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

class DestinationSettings {
	name?: string;
	url?: string;
	authHeaderName?: string;
	authHeaderValue?: string;
}

interface HTTPPublishPluginSettings {
	destinations: DestinationSettings[];
}

const DEFAULT_SETTINGS: HTTPPublishPluginSettings = {
	destinations: []
}

export default class HTTPPublishPlugin extends Plugin {
	settings: HTTPPublishPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'http-publish',
			name: 'HTTP Publish',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
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

class SettingTab extends PluginSettingTab {
	plugin: HTTPPublishPlugin;
	newDestination: DestinationSettings;

	constructor(app: App, plugin: HTTPPublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.newDestination = {};
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
					this.newDestination.name = v;
				}).setValue(this.newDestination.name || '');
			});
		new Setting(containerEl)
			.setName("URL")
			.addText(comp => {
				comp.setPlaceholder("https://example.org").onChange((v) => {
					this.newDestination.url = v;
				}).setValue(this.newDestination.url || '');
			});
		new Setting(containerEl)
			.setName("Authorization header name")
			.addText(comp => {
				comp.setPlaceholder("Authorization").onChange((v) => {
					this.newDestination.authHeaderName = v;
				}).setValue(this.newDestination.authHeaderName || '');
			});
		new Setting(containerEl)
			.setName("Authorization header value")
			.addText(comp => {
				comp.setPlaceholder("Bearer 12345").onChange((v) => {
					this.newDestination.authHeaderValue = v;
				}).setValue(this.newDestination.authHeaderValue || '');
			});
		new Setting(containerEl).addButton(button => {
			button.setButtonText("Add destination").onClick(async (evt) => {
				// TODO: Validate those settings
				this.plugin.settings.destinations.push({
					name: this.newDestination.name,
					url: this.newDestination.url,
					authHeaderName: this.newDestination.authHeaderName,
					authHeaderValue: this.newDestination.authHeaderValue
				});
				this.newDestination = {};
				await this.plugin.saveSettings();
				this.display();
			});
		})
	}
}
