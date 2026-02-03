import type { Artifact } from "@/types/chat";

/**
 * Parse artifacts from AI response content
 * Format: <!--ARTIFACT:{"id":"main","type":"code","title":"main.ts","language":"typescript"}-->
 * ```typescript
 * // code
 * ```
 * <!--/ARTIFACT-->
 */
export function parseArtifacts(content: string): {
  artifacts: Artifact[];
  contentWithoutArtifacts: string;
} {
  // More flexible regex that handles various whitespace/newline variations
  const artifactRegex =
    /<!--ARTIFACT:\s*([\s\S]*?)\s*-->\s*```(\w+)?\r?\n([\s\S]*?)```\s*<!--\/ARTIFACT-->/g;
  const artifacts: Artifact[] = [];
  const now = new Date().toISOString();

  const contentWithoutArtifacts = content.replace(
    artifactRegex,
    (match, metaJson, language, code) => {
      try {
        // Clean up the JSON (remove any extra whitespace/newlines)
        const cleanedJson = metaJson.trim().replace(/\n/g, "");
        const meta = JSON.parse(cleanedJson) as {
          id: string;
          type?: "code" | "component" | "config";
          title: string;
          language?: string;
        };

        artifacts.push({
          id: meta.id,
          type: meta.type || "code",
          title: meta.title,
          content: code.trim(),
          language: meta.language || language || "text",
          createdAt: now,
          updatedAt: now,
          version: 1,
        });

        return `\n> **${meta.title}** が右パネルに表示されています\n`;
      } catch (e) {
        // If parsing fails, leave the content as-is
        console.error("Failed to parse artifact:", e, metaJson);
        return match;
      }
    }
  );

  return { artifacts, contentWithoutArtifacts };
}

/**
 * Extract code blocks from markdown (fallback for non-artifact format)
 * This is the legacy method kept for backward compatibility
 */
export function extractCodeBlocks(content: string): Artifact[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const artifacts: Artifact[] = [];
  const now = new Date().toISOString();
  let index = 0;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    index++;
    const language = match[1] || "text";
    const code = match[2].trim();

    // Skip if this is part of an artifact (already processed)
    const beforeMatch = content.slice(0, match.index);
    if (beforeMatch.includes("<!--ARTIFACT:") && !beforeMatch.includes("<!--/ARTIFACT-->")) {
      continue;
    }

    artifacts.push({
      id: `code-${index}-${Date.now()}`,
      type: "code",
      title: `${language} #${index}`,
      content: code,
      language,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
  }

  return artifacts;
}

/**
 * Update an existing artifact with new content
 */
export function updateArtifact(
  existing: Artifact,
  newContent: string,
  newTitle?: string
): Artifact {
  return {
    ...existing,
    content: newContent,
    title: newTitle || existing.title,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
}

/**
 * Merge newly parsed artifacts with existing ones
 * - If ID matches, update the existing artifact
 * - If ID is new, add it
 */
export function mergeArtifacts(
  existing: Record<string, Artifact>,
  newArtifacts: Artifact[]
): Record<string, Artifact> {
  const result = { ...existing };

  for (const artifact of newArtifacts) {
    if (result[artifact.id]) {
      // Update existing artifact
      result[artifact.id] = updateArtifact(result[artifact.id], artifact.content, artifact.title);
    } else {
      // Add new artifact
      result[artifact.id] = artifact;
    }
  }

  return result;
}

/**
 * Replace code blocks in content with placeholder text
 */
export function replaceCodeBlocksWithPlaceholder(content: string): string {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let index = 0;

  return content.replace(codeBlockRegex, (match) => {
    // Check if this is part of an artifact
    const beforeMatch = content.slice(0, content.indexOf(match));
    if (beforeMatch.includes("<!--ARTIFACT:") && !beforeMatch.includes("<!--/ARTIFACT-->")) {
      return match;
    }

    index++;
    return `\n> 📄 **コード ${index}** が右パネルに表示されています\n`;
  });
}
