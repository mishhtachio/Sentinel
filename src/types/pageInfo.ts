import type { SecretFinding } from "../analyze/secrets";
import type { MixedContentItem } from "../analyze/mixedContent";
import type { UnsafeLink } from "../analyze/links";

export interface PageInfo {
    title: string;
    url: string;
    scripts: number;
    links: number;
    images: number;
    technologies: string[];
    findings?: SecretFinding[];
    mixedContent?: MixedContentItem[];
    unsafeLinks?: UnsafeLink[];
}