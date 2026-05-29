export interface ReviewResultInline {
  path: string;
  /** Line in the NEW file (RIGHT side of diff). 1-indexed. */
  line: number;
  severity: "warning" | "suggestion" | "nit" | "praise";
  body: string;
}

export interface ReviewResult {
  /** Markdown summary, posted as the main review body. */
  summary: string;
  /**
   * Recommended review verdict. The bot uses COMMENT by default;
   * APPROVE/REQUEST_CHANGES require explicit opt-in via config.
   */
  verdict: "comment" | "approve" | "request_changes";
  inline: ReviewResultInline[];
  /** Optional structured breakdown shown in the summary. */
  highlights?: {
    security?: string[];
    bugs?: string[];
    performance?: string[];
    style?: string[];
    tests?: string[];
  };
}
