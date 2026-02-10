import type { Artifact } from "@/types/chat";

// Extended Artifact type with truncation info
export interface ParsedArtifact extends Artifact {
  isTruncated?: boolean;
}

/**
 * Parse artifacts from AI response content
 * Format: <!--ARTIFACT:{"id":"main","type":"code","title":"main.ts","language":"typescript"}-->
 * ```typescript
 * // code
 * ```
 * <!--/ARTIFACT-->
 *
 * Also handles truncated artifacts (missing closing tag)
 */
export function parseArtifacts(content: string): {
  artifacts: ParsedArtifact[];
  contentWithoutArtifacts: string;
  hasTruncatedArtifact: boolean;
} {
  // More flexible regex that handles various whitespace/newline variations
  const artifactRegex =
    /<!--ARTIFACT:\s*([\s\S]*?)\s*-->\s*```(\w+)?\r?\n([\s\S]*?)```\s*<!--\/ARTIFACT-->/g;
  const artifacts: ParsedArtifact[] = [];
  const now = new Date().toISOString();
  let hasTruncatedArtifact = false;

  // Track IDs to ensure uniqueness within this parse
  const usedIds = new Set<string>();

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

        // Create unique ID by combining meta.id with title to prevent collisions
        // This ensures different files (e.g., "Counter.tsx" and "App.tsx") get different IDs
        let uniqueId = `${meta.id}-${meta.title}`;

        // If ID is already used (same id+title), append a suffix
        let suffix = 1;
        while (usedIds.has(uniqueId)) {
          uniqueId = `${meta.id}-${meta.title}-${suffix}`;
          suffix++;
        }
        usedIds.add(uniqueId);

        artifacts.push({
          id: uniqueId,
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

  // Check for truncated artifacts (has opening tag but no closing tag)
  const truncatedArtifact = parseTruncatedArtifact(contentWithoutArtifacts);
  if (truncatedArtifact) {
    artifacts.push(truncatedArtifact);
    hasTruncatedArtifact = true;
    // Remove the truncated artifact from content
    const truncatedRegex = /<!--ARTIFACT:\s*[\s\S]*?-->\s*```(\w+)?\r?\n[\s\S]*$/;
    const cleanedContent = contentWithoutArtifacts.replace(
      truncatedRegex,
      "\n> ⚠️ **コードが途中で切れています** - 「続きを生成」をクリックしてください\n"
    );
    return { artifacts, contentWithoutArtifacts: cleanedContent, hasTruncatedArtifact };
  }

  return { artifacts, contentWithoutArtifacts, hasTruncatedArtifact };
}

/**
 * Parse a truncated artifact (missing closing tag)
 * Returns the partial artifact if found, null otherwise
 */
function parseTruncatedArtifact(content: string): ParsedArtifact | null {
  // Check if there's an unclosed artifact
  const openTagMatch = content.match(/<!--ARTIFACT:\s*([\s\S]*?)\s*-->\s*```(\w+)?\r?\n([\s\S]*)$/);
  if (!openTagMatch) return null;

  // Make sure there's no closing tag after this
  const afterOpen = openTagMatch[0];
  if (afterOpen.includes("<!--/ARTIFACT-->")) return null;

  try {
    const metaJson = openTagMatch[1].trim().replace(/\n/g, "");
    const meta = JSON.parse(metaJson) as {
      id: string;
      type?: "code" | "component" | "config";
      title: string;
      language?: string;
    };
    const language = openTagMatch[2] || meta.language || "text";
    let code = openTagMatch[3] || "";

    // Remove incomplete closing backticks if any
    code = code.replace(/`{0,2}$/, "").trim();

    const now = new Date().toISOString();
    return {
      id: `${meta.id}-${meta.title}-truncated`,
      type: meta.type || "code",
      title: `${meta.title} (途中)`,
      content: code,
      language,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isTruncated: true,
    };
  } catch (e) {
    console.error("Failed to parse truncated artifact:", e);
    return null;
  }
}

/**
 * Check if content likely has a truncated artifact or code block
 */
export function hasIncompleteContent(content: string): boolean {
  // Check for unclosed artifact
  const artifactOpens = (content.match(/<!--ARTIFACT:/g) || []).length;
  const artifactCloses = (content.match(/<!--\/ARTIFACT-->/g) || []).length;
  if (artifactOpens > artifactCloses) return true;

  // Check for unclosed code block (odd number of triple backticks)
  const backtickMatches = content.match(/```/g) || [];
  if (backtickMatches.length % 2 !== 0) return true;

  return false;
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

/**
 * Remove <!--EXPLAIN_CODE--> tags from content (for explanation mode)
 * The code is displayed in the side panel, so we just remove the tags
 */
export function removeExplainCodeTags(content: string): string {
  const explainCodeRegex = /<!--EXPLAIN_CODE:\w*-->\n?([\s\S]*?)<!--\/EXPLAIN_CODE-->\n?/g;

  return content.replace(explainCodeRegex, (match, code) => {
    // Replace with a placeholder indicating code is in the panel
    return `\n> コードを右パネルに表示しています\n\n`;
  });
}
