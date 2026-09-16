const STAGE_ORDER = [
  'PO', 'SOS', 'BOM, PID, EWD, GAD', 'Review & Approval',
  'Procurement of Material', 'Collecting Material / Inspection',
  'Fabrication', 'Delivery', 'Installation', 'Commissioning',
  'Preparation Manual Book', 'Hand Over and Finished'
];
const STAGE_WEIGHTS = {
  'PO': 5, 'SOS': 10, 'BOM, PID, EWD, GAD': 25, 'Review & Approval': 30,
  'Procurement of Material': 45, 'Collecting Material / Inspection': 55,
  'Fabrication': 70, 'Delivery': 90, 'Installation': 95, 'Commissioning': 97,
  'Preparation Manual Book': 98, 'Hand Over and Finished': 100
};

function colorFor(progress) {
  if (progress >= 100) return '#3F8361';
  if (progress >= 90) return '#C98A2B';
  return '#1C4E73';
}

export default function StageGauge({ progress = 0, showLabel = true, compact = false, activeStage }) {
  const color = colorFor(progress);
  return (
    <div className="w-full">
      <div className="gauge-track" style={{ height: compact ? 6 : 10 }}>
        <div
          className="gauge-fill"
          style={{ width: `${Math.min(progress, 100)}%`, background: color }}
        />
        {!compact && STAGE_ORDER.map((stage) => {
          const w = STAGE_WEIGHTS[stage];
          return (
            <div
              key={stage}
              title={`${stage} (${w}%)`}
              className={`gauge-tick ${progress >= w ? 'reached' : ''}`}
              style={{ left: `${w}%`, height: compact ? 10 : 16 }}
            />
          );
        })}
      </div>
      {showLabel && (
        <div className="mt-1.5 flex justify-between text-xs font-data text-inkmute">
          <span>0%</span>
          <span className="font-medium" style={{ color }}>{progress}%</span>
          <span>100%</span>
        </div>
      )}
      {showLabel && activeStage && (
        <div className="mt-1 text-xs text-inkmute">
          Tahap saat ini: <span className="font-medium text-ink">{activeStage}</span>
        </div>
      )}
    </div>
  );
}
