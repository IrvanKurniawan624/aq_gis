import React from 'react';

const StatCard = ({ title, value, unit, icon: Icon, colorClass, subtitle }) => {
  return (
    <div className={`glass-card p-6 flex flex-col relative overflow-hidden group border-l-4 ${colorClass?.bg ? colorClass.bg.replace('bg-', 'border-') : 'border-blue-500'}`}>
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500 ${colorClass?.bg || 'bg-blue-500'}`}></div>
      
      <div className="flex items-center justify-between mb-4 z-10">
        <h3 className="text-slate-300 font-semibold text-sm tracking-widest uppercase">{title}</h3>
        {Icon && <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700`}><Icon className={`w-5 h-5 ${colorClass?.text || 'text-blue-400'}`} /></div>}
      </div>
      
      <div className="flex items-baseline gap-2 z-10">
        <span className={`text-5xl font-extrabold tracking-tight drop-shadow-sm ${colorClass?.text || 'text-white'}`}>{value}</span>
        {unit && <span className="text-slate-400 font-medium">{unit}</span>}
      </div>
      
      {subtitle && (
        <div className="mt-5 pt-4 border-t border-slate-700/50 z-10">
          <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700">
            <span className={`w-2 h-2 rounded-full mr-2 ${colorClass?.bg || 'bg-blue-500'}`}></span>
            <p className="text-sm font-medium text-slate-200">{subtitle}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatCard;
