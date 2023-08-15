
export class DestinationSettings {
	readonly name?: string;
	readonly url?: string;
	readonly authHeaderName?: string;
	readonly authHeaderValue?: string;

	constructor(name?: string, url?: string, authHeaderName?: string, authHeaderValue?: string) {
		this.name = normalizeValue(name);
		this.url = normalizeValue(url);
		this.authHeaderName = normalizeValue(authHeaderName);
		this.authHeaderValue = normalizeValue(authHeaderValue);
	}

	validate() {
		if (!this.name) {
            throw new Error('Name is required');
        }
        if (!this.url) {
            throw new Error('URL is required');
        }

        try {
            new URL(this.url);
        } catch {
            throw new Error('URL is invalid');
        }

        if (this.authHeaderValue && !this.authHeaderName) {
            throw new Error("Authorization name is required if an authorization name is set");
        }
	}
}

function normalizeValue(value?: string): string | undefined {
	if (!value) {
		return value;
	}
	return value.trim();
}

export interface HTTPPublishPluginSettings {
	destinations: DestinationSettings[];
}

export const DEFAULT_SETTINGS: HTTPPublishPluginSettings = {
	destinations: []
}