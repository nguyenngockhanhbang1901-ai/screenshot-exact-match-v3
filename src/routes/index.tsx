import { createFileRoute } from "@tanstack/react-router";
import Classroom from '@/components/Classroom';

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Đường thẳng và mặt phẳng · Hình học 3D' },
    { name: 'description', content: 'Lớp học hình học không gian tương tác dành cho giáo viên và các tổ học sinh.' },
    { property: 'og:title', content: 'Hình học 3D · Đường thẳng và mặt phẳng' },
    { property: 'og:description', content: 'Khám phá ba vị trí tương đối bằng mô hình 3D và bài làm theo tổ.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Classroom,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
