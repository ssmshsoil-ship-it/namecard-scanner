import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

const i18n = new I18n({ ko, en, ja });

i18n.locale = Localization.getLocales()[0].languageCode;
i18n.enableFallback = true;
i18n.defaultLocale = 'en';

export default i18n;