import { describe, it, expect } from "vitest";
import { newStepItem, stepToItem, itemToStep, type StepItem } from "./steps-editor";
import type { RecipeStep } from "$lib/recipe/schema";

describe("newStepItem", () => {
	it("creates a blank row of the requested kind with the given key", () => {
		expect(newStepItem("action", "k1")).toEqual({
			key: "k1",
			kind: "action",
			text: "",
			imageUrl: null,
			durationMin: 10,
		});
		expect(newStepItem("wait", "k2").kind).toBe("wait");
	});
});

describe("stepToItem", () => {
	it("seeds an action row, preserving its image url", () => {
		const step: RecipeStep = { kind: "action", text: "mix", imageUrl: "https://x/y.png" };
		expect(stepToItem(step, "k1")).toMatchObject({
			kind: "action",
			text: "mix",
			imageUrl: "https://x/y.png",
		});
	});

	it("normalizes a missing action image url to null", () => {
		const step = { kind: "action", text: "mix", imageUrl: null } as RecipeStep;
		expect(stepToItem(step, "k1").imageUrl).toBeNull();
	});

	it("seeds a wait row from durationMin and hides the image field", () => {
		const step: RecipeStep = { kind: "wait", text: "rest", durationMin: 30 };
		expect(stepToItem(step, "k1")).toMatchObject({
			kind: "wait",
			text: "rest",
			durationMin: 30,
			imageUrl: null,
		});
	});
});

describe("itemToStep", () => {
	it("projects an action item to an action step (drops the duration buffer)", () => {
		const item: StepItem = {
			key: "k1",
			kind: "action",
			text: "bake",
			imageUrl: "https://x/y.png",
			durationMin: 10,
		};
		expect(itemToStep(item)).toEqual({ kind: "action", text: "bake", imageUrl: "https://x/y.png" });
	});

	it("projects a wait item to a wait step (drops the image slot)", () => {
		const item: StepItem = {
			key: "k1",
			kind: "wait",
			text: "rest",
			imageUrl: null,
			durationMin: 45,
		};
		expect(itemToStep(item)).toEqual({ kind: "wait", text: "rest", durationMin: 45 });
	});

	it("round-trips a stored step through stepToItem → itemToStep unchanged", () => {
		const steps: RecipeStep[] = [
			{ kind: "action", text: "mix", imageUrl: null },
			{ kind: "action", text: "shape", imageUrl: "https://x/y.png" },
			{ kind: "wait", text: "prove", durationMin: 90 },
		];
		const out = steps.map((s, i) => itemToStep(stepToItem(s, `k${i}`)));
		expect(out).toEqual(steps);
	});
});
