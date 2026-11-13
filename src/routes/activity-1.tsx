import { createFileRoute } from '@tanstack/react-router';
import ActivityOne from '@/components/ActivityOne';

export const Route = createFileRoute('/activity-1')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Hoạt động 1 · Khung thành bóng đá 3D | Hình học 3D' },
    { name: 'description', content: 'Quan sát mô hình khung thành bóng đá 11 người bằng thép và lưới trong không gian 3D có thể xoay camera.' },
    { property: 'og:title', content: 'Hoạt động 1 · Khung thành bóng đá 3D' },
    { property: 'og:description', content: 'Mô hình 3D khung thành bóng đá để khám phá hình học không gian.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: ActivityOne,
});