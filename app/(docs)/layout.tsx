import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      sidebar={{ defaultOpenLevel: 2 }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}
