// https://developer.scrypted.app/
import { BufferConverter, ScryptedDeviceBase, Setting, Settings } from "@scrypted/sdk";
import { StorageSettings } from "@scrypted/sdk/storage-settings";
import { GOOGLE_TRANSLATE_LANGUAGES } from "./gtts-languages";

class GoogleCloudTts extends ScryptedDeviceBase implements BufferConverter, Settings {
  storageSettings = new StorageSettings(this, {
    language: {
      title: 'Language',
      description: 'Language used by Google Translate TTS.',
      choices: Object.keys(GOOGLE_TRANSLATE_LANGUAGES),
      defaultValue: 'en',
    },
    api_key: {
      title: 'API Key',
      description: 'Optional: API Key used by Google Cloud TTS which provides higher quality voices.',
    },
    voice: {
      title: 'Voice',
      description: 'Voice used by Google Cloud TTS.',
      defaultValue: 'Default',
      onPut: async (value: string) => {
        const found = this.voices.voices.find((voice: any) => voice.name === value);
        if (!found) {
          console.error('Voice not found.');
          return;
        }
        localStorage.setItem('voice_name', found.name);
        localStorage.setItem('voice_language_code', found.languageCodes[0]);
        localStorage.setItem('voice_gender', found.ssmlGender);
      }
    },
  });
  voices: any;

  constructor() {
    super();
    this.fromMimeType = 'text/plain';
    this.toMimeType = 'audio/mpeg';

    this.storageSettings.settings.voice.onGet = async () => {
      if (!this.getApiKey())
        return { hide: true };

      try {
        if (!this.voices) {
          const response = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${this.getApiKey()}`);
          if (!response.ok)
            throw new Error();
          this.voices = await response.json();
        }
      }
      catch (e) {
        return {};
      }
      return {
        choices: this.voices.voices.map(voice => voice.name),
      };
    };
  }

  getApiKey() {
    const apiKey = this.storage.getItem('api_key');
    return apiKey;
  }

  async convert(data: string | Buffer, fromMimeType: string): Promise<Buffer> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      const text = data.toString();
      const url = new URL('http://translate.google.com/translate_tts');
      const params = url.searchParams;

      params.append('ie', 'UTF-8');
      params.append('tl', this.storageSettings.values.language || 'en');
      params.append('q', text);
      params.append('total', '1');
      params.append('idx', '0');
      params.append('client', 'tw-ob');
      params.append('textlen', text.length.toString());

      const response = await fetch(url.toString());
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    }

    const voice_name = this.storage.getItem("voice_name") || "en-GB-Standard-A";
    const voice_gender = this.storage.getItem("voice_gender") || "FEMALE";
    const voice_language_code = this.storage.getItem("voice_language_code") || "en-GB";

    const from = Buffer.from(data);
    var json = {
      "input": {
        "text": from.toString()
      },
      "voice": {
        "languageCode": voice_language_code,
        "name": voice_name,
        "ssmlGender": voice_gender
      },
      "audioConfig": {
        "audioEncoding": "MP3"
      }
    };

    const result = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      body: JSON.stringify(json),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const responseData = await result.json();
    console.log(JSON.stringify(responseData, null, 2));
    const buffer = Buffer.from(responseData.audioContent, 'base64');
    return buffer;
  }

  async getSettings(): Promise<Setting[]> {
    return this.storageSettings.getSettings();
  }
  async putSetting(key: string, value: string | number | boolean) {
    return this.storageSettings.putSetting(key, value);
  }
}

export default GoogleCloudTts;
