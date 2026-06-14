<script lang="ts">
	// Dev-only kit sandbox: every Phase-2 generic component in light + dark.
	// Not a product screen — copy here isn't routed through i18n.
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
	import { Alert, AlertDescription } from "$lib/components/ui/alert";
	import { Panel } from "$lib/components/ui/panel";
	import { Env } from "$lib/components/ui/env";
	import { IconButton } from "$lib/components/ui/icon-button";
	import { Badge } from "$lib/components/ui/badge";
	import { Status, Dot } from "$lib/components/ui/status";
	import { MacroBar } from "$lib/components/ui/macro-bar";
	import { Gauge, type Macro } from "$lib/components/ui/gauge";
	import { SegmentedToggle } from "$lib/components/ui/segmented";
	import { Metric } from "$lib/components/ui/metric";

	let dark = $state(false);
	let view = $state("day");
	const macros: { macro: Macro; label: string; pct: number; val: string }[] = [
		{ macro: "kcal", label: "Energia", pct: 72, val: "2 140" },
		{ macro: "pro", label: "Białko", pct: 48, val: "112" },
		{ macro: "carb", label: "Węgle", pct: 64, val: "210" },
		{ macro: "fat", label: "Tłuszcze", pct: 86, val: "78" },
	];
</script>

<div class:dark class="relative min-h-screen bg-background text-foreground">
	<Env class="absolute" />
	<div class="relative mx-auto max-w-3xl space-y-8 px-6 py-10">
		<header class="flex items-center justify-between">
			<h1 class="text-[1.5rem] font-semibold tracking-[-0.015em]">Kit — spatial glass</h1>
			<Button variant="secondary" size="sm" onclick={() => (dark = !dark)}>
				{dark ? "Light" : "Dark"}
			</Button>
		</header>

		<!-- Metrics on a solid backing -->
		<Panel variant="solid" class="flex items-end gap-8 p-6">
			<div>
				<div class="mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">Dziś</div>
				<Metric value="2 140" unit="kcal" />
			</div>
			<div>
				<div class="mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-muted-foreground">Białko</div>
				<Metric value="112" unit="g" size="sm" />
			</div>
			<Status tone="positive">Na celu</Status>
		</Panel>

		<!-- Gauges -->
		<Panel variant="regular" class="grid grid-cols-4 place-items-center gap-4 p-6">
			{#each macros as m (m.macro)}
				<Gauge value={m.pct} macro={m.macro} display={m.val} unit={m.macro === "kcal" ? "kcal" : "g"} label={m.label} />
			{/each}
		</Panel>

		<!-- Adherence bars -->
		<Panel class="space-y-4 p-6">
			<div class="flex items-center justify-between">
				<span class="text-sm">Dzień / tydzień</span>
				<SegmentedToggle
					bind:value={view}
					items={[
						{ value: "day", label: "Dzień" },
						{ value: "week", label: "Tydzień" },
					]}
				/>
			</div>
			<div class="space-y-2">
				<div class="flex items-center justify-between text-sm"><span>Energia</span><Status tone="positive">−120 kcal</Status></div>
				<MacroBar value={72} tone="positive" />
				<div class="flex items-center justify-between text-sm"><span>Tłuszcze</span><Status tone="caution">blisko limitu</Status></div>
				<MacroBar value={86} tone="caution" />
				<div class="flex items-center justify-between text-sm"><span>Sód</span><Status tone="destructive">+340 mg</Status></div>
				<MacroBar value={100} tone="destructive" />
			</div>
		</Panel>

		<!-- Form controls -->
		<Card>
			<CardHeader>
				<CardTitle>Formularz</CardTitle>
				<CardDescription>Inputy, etykiety i przyciski na nowych tokenach.</CardDescription>
			</CardHeader>
			<CardContent class="space-y-3">
				<div class="space-y-1.5">
					<Label for="e">E-mail</Label>
					<Input id="e" type="email" placeholder="ty@przyklad.pl" />
				</div>
				<div class="flex flex-wrap gap-2">
					<Button>Zapisz</Button>
					<Button variant="secondary">Anuluj</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="destructive">Usuń</Button>
					<IconButton aria-label="Dodaj">
						<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
					</IconButton>
					<IconButton variant="subtle" aria-label="Dodaj">
						<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
					</IconButton>
					<IconButton variant="ghost" aria-label="Zamknij">
						<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" /></svg>
					</IconButton>
				</div>
			</CardContent>
		</Card>

		<!-- Panels + badges + alerts -->
		<div class="grid grid-cols-2 gap-4">
			<Panel variant="thick" class="space-y-2 p-5">
				<div class="flex items-center gap-2">
					<Badge>USDA</Badge>
					<Badge variant="outline">SR Legacy</Badge>
				</div>
				<p class="text-sm text-muted-foreground">Panel thick (raised glass).</p>
			</Panel>
			<Panel class="flex items-center gap-2 p-5">
				<Dot tone="positive" /><span class="text-sm">Na celu</span>
				<Dot tone="caution" /><span class="text-sm">Blisko</span>
				<Dot tone="destructive" /><span class="text-sm">Przekroczono</span>
			</Panel>
		</div>

		<Alert>
			<AlertDescription>Neutralny komunikat na powierzchni karty.</AlertDescription>
		</Alert>
		<Alert variant="destructive">
			<AlertDescription>Błąd: nieprawidłowe dane logowania.</AlertDescription>
		</Alert>
	</div>
</div>
