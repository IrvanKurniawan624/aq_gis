import React from 'react';

const StatCard = ({ title, value, unit, subtitle, compact = false }) => {
  return (
    <section className={`resident-stat ${compact ? 'resident-stat-compact' : ''}`}>
      <p className="resident-eyebrow">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className={compact ? 'resident-stat-value-small' : 'resident-stat-value'}>{value}</span>
          {unit && <span className="resident-stat-unit">{unit}</span>}
        </div>
        {subtitle && (
          <p className="resident-status"><span className="resident-status-dot" />{subtitle}</p>
        )}
      </div>
    </section>
  );
};

export default StatCard;
