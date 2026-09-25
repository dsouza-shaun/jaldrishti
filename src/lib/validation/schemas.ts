import { z } from "zod";

const finiteNumber = z.coerce.number().finite();

export const projectInputSchema = z
  .object({
    projectName: z.string().trim().min(1).max(200),
    latitude: finiteNumber.min(5).max(38.5),
    longitude: finiteNumber.min(67).max(98.5),
    itLoad: finiteNumber.positive().max(1_000_000),
    pue: finiteNumber.min(1).max(10),
    wue: finiteNumber.min(0).max(100),
    coolingType: z.enum([
      "air-cooled-chiller",
      "water-cooled-chiller",
      "adiabatic",
      "hybrid",
      "direct-liquid",
    ]),
    builtUpArea: finiteNumber.nonnegative().max(100_000_000).optional(),
    landTenure: z.enum(["midc", "private-freehold", "other"]),
    proposedWaterSource: z.enum([
      "groundwater",
      "surface",
      "municipal",
      "tanker",
      "mixed",
    ]),
    alternativeWaterSource: z.string().trim().min(1).max(100).optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const scenarioInputSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    itLoad: finiteNumber.positive().max(1_000_000).optional(),
    pue: finiteNumber.min(1).max(10).optional(),
    wue: finiteNumber.min(0).max(100).optional(),
    coolingType: projectInputSchema.shape.coolingType.optional(),
    proposedWaterSource: projectInputSchema.shape.proposedWaterSource.optional(),
  })
  .strict();

export function validationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join("; ");
}
