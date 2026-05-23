import { pl, type Translations } from "./pl";

const translations: Record<string, Translations> = { pl };

type PathKeys<T, Prefix extends string = ""> =
	T extends Record<string, unknown>
		? {
				[K in keyof T & string]: T[K] extends Record<string, unknown>
					? PathKeys<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>
					: Prefix extends ""
						? K
						: `${Prefix}.${K}`;
			}[keyof T & string]
		: never;

export type TranslationKey = PathKeys<Translations>;

export function t(key: TranslationKey, locale: string = "pl"): string {
	const dict = translations[locale] ?? translations.pl;
	const parts = key.split(".");
	let result: unknown = dict;
	for (const part of parts) {
		result = (result as Record<string, unknown>)[part];
	}
	return result as string;
}
