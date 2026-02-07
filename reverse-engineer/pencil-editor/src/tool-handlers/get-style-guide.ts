import type { SendAPIRequest } from "../types";

export const handleGetStyleGuideTags = async (
  sendAPIRequest: SendAPIRequest,
): Promise<string> => {
  const { success, tags } = await sendAPIRequest(
    "POST",
    "style-guide-tags",
    {},
  );

  if (!success || !tags) {
    throw new Error(`Failed to retrieve style guide tags`);
  }

  return `The available tags to pick a style guide: ${tags.join(", ")}`;
};

export const handleGetStyleGuide = async (
  tags: string[],
  id: string | undefined,
  sendAPIRequest: SendAPIRequest,
): Promise<string> => {
  const { success, guide } = await sendAPIRequest("POST", "style-guide", {
    tags,
    id,
  });

  if (!success || !guide) {
    throw new Error(`Failed to retrieve style guide`);
  }

  return `# Use the following style guide in the current design task\n\n${guide}`;
};
