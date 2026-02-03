"use client";

import { useRef, useEffect, useCallback } from "react";

interface UseAutoScrollOptions {
  /** Threshold in pixels from bottom to consider "at bottom" */
  threshold?: number;
  /** Enable/disable auto-scroll */
  enabled?: boolean;
}

interface UseAutoScrollReturn {
  /** Ref to attach to the scroll container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to attach to the element at the end of content */
  endRef: React.RefObject<HTMLDivElement | null>;
  /** Scroll to bottom programmatically */
  scrollToBottom: () => void;
  /** Whether user is currently at the bottom */
  isAtBottom: React.RefObject<boolean>;
}

/**
 * Hook that manages auto-scrolling behavior while respecting user scroll position.
 * Auto-scroll only occurs when user is already at the bottom of the container.
 */
export function useAutoScroll(
  dependency: unknown,
  options: UseAutoScrollOptions = {}
): UseAutoScrollReturn {
  const { threshold = 100, enabled = true } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const userScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, [threshold]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use scrollTop instead of scrollIntoView to avoid text selection issues
    container.scrollTop = container.scrollHeight;
  }, []);

  // Handle scroll events to detect user scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Clear any existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      userScrolling.current = true;
      isAtBottom.current = checkIfAtBottom();

      // Reset userScrolling flag after scroll settles
      scrollTimeout.current = setTimeout(() => {
        userScrolling.current = false;
      }, 150);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [checkIfAtBottom]);

  // Auto-scroll only when at bottom and not user-scrolling
  useEffect(() => {
    if (!enabled) return;

    // Small delay to let the DOM update
    const timeoutId = setTimeout(() => {
      if (isAtBottom.current && !userScrolling.current) {
        scrollToBottom();
      }
    }, 10);

    return () => clearTimeout(timeoutId);
  }, [dependency, enabled, scrollToBottom]);

  return {
    containerRef,
    endRef,
    scrollToBottom,
    isAtBottom,
  };
}
