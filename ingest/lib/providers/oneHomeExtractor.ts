import Anthropic from "@anthropic-ai/sdk";
import { SpecSheetListing } from "./specSheetParser";

const MODEL = "claude-sonnet-5";

export interface ExtractedListingFields {
  providerListingId: string;
  address: string;
  listPrice: number;
  lotWidthFeet: number | null;
  lotDepthFeet: number | null;
  buildingSqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  status: string;
}

const EXTRACT_LISTING_TOOL: Anthropic.Tool = {
  name: "extract_listing",
  description:
    "Extract structured real-estate listing fields from the rendered text of a OneHome property detail page.",
  input_schema: {
    type: "object",
    properties: {
      providerListingId: { type: "string", description: "MLS number, e.g. X13612950" },
      address: { type: "string", description: "Full street address including city and postal code" },
      listPrice: { type: "number", description: "Asking price in dollars, no currency symbol or commas" },
      lotWidthFeet: { type: ["number", "null"], description: "Lot width in feet, from Lot Size Dimensions" },
      lotDepthFeet: { type: ["number", "null"], description: "Lot depth in feet, from Lot Size Dimensions" },
      buildingSqft: {
        type: ["number", "null"],
        description: "Above-grade finished area in sqft. If only a range is given, use the midpoint.",
      },
      yearBuilt: { type: ["number", "null"], description: "Year built, if listed" },
      propertyType: { type: "string", description: "e.g. Detached, Semi-Detached, Duplex, Multi-Family" },
      status: { type: "string", description: "Listing status, e.g. active, sold, conditional" },
    },
    required: ["providerListingId", "address", "listPrice", "propertyType", "status"],
  },
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Lower-level call that also surfaces token usage — split out from
 * extractListingFromText below so scripts/devCompareExtractionModels.ts
 * can report real per-model cost/accuracy instead of an estimate, and so
 * the model is swappable for that comparison without affecting the
 * production extraction path's return shape.
 */
export async function callExtractListingTool(
  rawPageText: string,
  detailUrl: string,
  model: string = MODEL
): Promise<{ fields: ExtractedListingFields; usage: Anthropic.Usage }> {
  const message = await getClient().messages.create({
    model,
    max_tokens: 1024,
    tools: [EXTRACT_LISTING_TOOL],
    tool_choice: { type: "tool", name: "extract_listing" },
    messages: [
      {
        role: "user",
        content: `Extract the listing fields from this OneHome property detail page text:\n\n${rawPageText}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Claude did not return a tool_use block for ${detailUrl}`);
  }

  return { fields: toolUse.input as ExtractedListingFields, usage: message.usage };
}

/**
 * Uses a Claude model (instead of hand-written field regexes, which are
 * fragile across listing types — condo vs. detached vs. land — and any
 * OneHome layout drift) to extract structured listing fields from a
 * property detail page's rendered text.
 */
export async function extractListingFromText(
  rawPageText: string,
  detailUrl: string
): Promise<SpecSheetListing> {
  const { fields } = await callExtractListingTool(rawPageText, detailUrl);

  const lotWidthM = fields.lotWidthFeet != null ? fields.lotWidthFeet * 0.3048 : null;
  const lotDepthM = fields.lotDepthFeet != null ? fields.lotDepthFeet * 0.3048 : null;

  return {
    providerListingId: fields.providerListingId,
    address: fields.address,
    neighborhood: "",
    listPrice: fields.listPrice,
    lotWidthM,
    lotDepthM,
    lotAreaSqm: lotWidthM != null && lotDepthM != null ? lotWidthM * lotDepthM : null,
    buildingSqft: fields.buildingSqft,
    yearBuilt: fields.yearBuilt,
    propertyType: fields.propertyType,
    status: fields.status.toLowerCase(),
    raw: { scrapedText: rawPageText, detailUrl },
  };
}
