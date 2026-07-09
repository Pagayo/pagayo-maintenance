interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

export function Spinner({ size = 'md', className = '', color }: SpinnerProps) {
  const sizeClass = `spinner-${size}`;

  return (
    <div
      className={`spinner ${sizeClass} ${className}`.trim()}
      style={color ? { color } : undefined}
      role="status"
      aria-label="Laden..."
    />
  );
}
