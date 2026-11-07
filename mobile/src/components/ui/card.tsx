import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Soft, rounded surface used for grouped content. `tone="lavender"` is the gentle highlight variant. */
export function Card({
  children,
  tone = 'plain',
  className = '',
}: {
  children: ReactNode;
  tone?: 'plain' | 'lavender';
  className?: string;
}) {
  return (
    <View
      className={`gap-3 rounded-3xl p-5 ${tone === 'lavender' ? 'bg-secondary' : 'border border-border bg-card'} ${className}`}
      style={
        tone === 'plain'
          ? {
              shadowColor: '#6d6193',
              shadowOpacity: 0.08,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
            }
          : undefined
      }>
      {children}
    </View>
  );
}
