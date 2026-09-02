import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Callout } from 'fumadocs-ui/components/callout';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import LatestVersion from '@/components/LatestVersion';
import GitHubStars from '@/components/GitHubStars';

// Only Callout, Card(s), CodeBlockTab(s) and the base HTML elements are
// registered by default. Tabs, Steps, Files and Accordion are not - and an
// unregistered component does not warn, it fails the build with
// "Expected component `Tab` to be defined" during prerender. Registering them
// all here keeps content authoring independent of this file.
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Callout,
    Tab,
    Tabs,
    Step,
    Steps,
    Accordion,
    Accordions,
    File,
    Files,
    Folder,
    LatestVersion,
    GitHubStars,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
