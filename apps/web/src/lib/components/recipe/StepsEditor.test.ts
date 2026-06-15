import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/svelte";
import StepsEditor from "./StepsEditor.svelte";
import { t } from "$lib/i18n";
import type { RecipeStep } from "$lib/recipe/schema";

// Component render test for finding #8: the steps projection is a pure `$derived` exposed via
// `currentSteps()` (no `$effect` write-back), and the parent reads it at submit. This exercises the
// real submit-capture path — edits/adds/removes to the keyed model must surface through the getter
// on demand. Runs under client-mode Svelte (vitest.config.ts `resolve.conditions: ["browser"]`),
// where effects/derives actually run.
afterEach(() => cleanup());

type Instance = { currentSteps: () => RecipeStep[] };

function renderEditor(steps: RecipeStep[]) {
	const result = render(StepsEditor, { props: { steps } });
	return { ...result, instance: result.component as unknown as Instance };
}

describe("StepsEditor — currentSteps() projection (no effect write-back)", () => {
	it("projects the seeded steps on first read", () => {
		const steps: RecipeStep[] = [
			{ kind: "action", text: "mix", imageUrl: null },
			{ kind: "wait", text: "rest", durationMin: 30 },
		];
		const { instance } = renderEditor(steps);
		expect(instance.currentSteps()).toEqual(steps);
	});

	it("reflects an edited action step's text on the next read", async () => {
		const { instance } = renderEditor([{ kind: "action", text: "mix", imageUrl: null }]);

		// The first action row's textarea is labelled "<stepsTitle> 1".
		const textarea = screen.getByLabelText(`${t("recipe.form.stepsTitle")} 1`);
		await fireEvent.input(textarea, { target: { value: "blend well" } });

		expect(instance.currentSteps()).toEqual([
			{ kind: "action", text: "blend well", imageUrl: null },
		]);
	});

	it("reflects an edited wait step's duration on the next read", async () => {
		const { instance } = renderEditor([{ kind: "wait", text: "rest", durationMin: 30 }]);

		const duration = screen.getByLabelText(t("recipe.form.waitDurationLabel"));
		await fireEvent.input(duration, { target: { value: "45" } });

		expect(instance.currentSteps()).toEqual([{ kind: "wait", text: "rest", durationMin: 45 }]);
	});

	it("appends a blank wait step when 'Dodaj oczekiwanie' is clicked", async () => {
		const { instance } = renderEditor([{ kind: "action", text: "mix", imageUrl: null }]);

		await fireEvent.click(screen.getByRole("button", { name: t("recipe.form.addWait") }));

		const out = instance.currentSteps();
		expect(out).toHaveLength(2);
		expect(out[1]).toEqual({ kind: "wait", text: "", durationMin: 10 });
	});

	it("drops a row when its remove button is clicked", async () => {
		const { instance, container } = renderEditor([
			{ kind: "action", text: "mix", imageUrl: null },
			{ kind: "wait", text: "rest", durationMin: 30 },
		]);

		// Real <button> remove controls only (the drag grips are role=button spans sharing the label).
		const removeButtons = container.querySelectorAll<HTMLButtonElement>(
			`button[aria-label="${t("recipe.form.removeStep")}"]`,
		);
		expect(removeButtons).toHaveLength(2);
		await fireEvent.click(removeButtons[0]);

		expect(instance.currentSteps()).toEqual([{ kind: "wait", text: "rest", durationMin: 30 }]);
	});
});
