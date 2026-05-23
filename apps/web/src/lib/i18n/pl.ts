export const pl = {
	common: {
		appName: "LifeOS",
		loading: "Ładowanie...",
		save: "Zapisz",
		cancel: "Anuluj",
		delete: "Usuń",
		edit: "Edytuj",
		back: "Wróć",
		next: "Dalej",
		search: "Szukaj",
		error: "Wystąpił błąd",
		notFound: "Nie znaleziono strony",
	},
	auth: {
		login: "Zaloguj się",
		register: "Zarejestruj się",
		logout: "Wyloguj się",
		email: "Email",
		password: "Hasło",
		name: "Imię",
	},
} as const;

export type Translations = typeof pl;
