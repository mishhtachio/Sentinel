import type { SecretFinding } from "../analyze/secrets";
import type { MixedContentItem } from "../analyze/mixedContent";

export interface PageInfo {
    title: string;
    url: string;
    scripts: number;
    links: number;
    images: number;
    technologies: string[];
    findings?: SecretFinding[];
    mixedContent?: MixedContentItem[];
}