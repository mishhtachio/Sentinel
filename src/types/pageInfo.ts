import type { SecretFinding } from "../analyze/secrets";

export interface PageInfo {
    title: string;
    url: string;
    scripts: number;
    links: number;
    images: number;
    technologies: string[];
    findings?: SecretFinding[];
}