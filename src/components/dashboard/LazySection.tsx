"use client";

import { type ReactNode } from 'react';
import SectionSkeleton from './SectionSkeleton';
import SectionWrapper from './SectionWrapper';
import { useInView } from '@/hooks/useInView';

interface Props {
  title: string;
  children: ReactNode;
  skeletonHeight?: number;
  className?: string;
}

export default function LazySection({
  title,
  children,
  skeletonHeight,
  className,
}: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={className}>
      <SectionWrapper title={title}>
        {inView ? children : <SectionSkeleton title={title} height={skeletonHeight} />}
      </SectionWrapper>
    </div>
  );
}
