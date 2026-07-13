import { t } from '@/lib/i18n/server';
import { DELIVERY_STAGE_ORDER, type DeliveryStage } from '../types';

/** Visual progress across the 9-stage lifecycle (task brief's own
 *  numbered list, verbatim) - read-only; every transition happens via
 *  `DeliveryActionsPanel`'s stage-specific action, never a direct click
 *  here. */
export default function DeliveryStageTracker({ stage }: { stage: DeliveryStage }) {
  const currentIndex = DELIVERY_STAGE_ORDER.indexOf(stage);

  return (
    <div className="flex flex-wrap gap-2">
      {DELIVERY_STAGE_ORDER.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div
            key={s}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              active ? 'bg-brand-primary text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i + 1}. {t(`delivery.stage.${s}`)}
          </div>
        );
      })}
    </div>
  );
}
