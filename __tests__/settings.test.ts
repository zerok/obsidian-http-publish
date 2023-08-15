import { DestinationSettings } from "../src/settings";

describe('Destination settings', () => {
    test('Default settings are invalid', () => {
        let sut = new DestinationSettings();
        expect(() => {
            sut.validate();
        }).toThrow();
    });

    test('URL must be a URL', () => {
        let sut = new DestinationSettings("default", "lala");
        expect(() => {
            sut.validate();
        }).toThrow();

        sut = new DestinationSettings("default", "http://lala");
        expect(() => {
            sut.validate();
        }).not.toThrow();
    });

    test('Authorization value requires also an authorization name', () => {
        let sut = new DestinationSettings("default", "http://lala", undefined, "something");
        expect(() => {
            sut.validate();
        }).toThrow();

        sut = new DestinationSettings("default", "http://lala", "name", "value");
        expect(() => {
            sut.validate();
        }).not.toThrow();
    });
});