import React from 'react';
import { useTranslation } from 'react-i18next';
import InfoTip from './InfoTip';
import { TAG_GROUPS, TAG_META } from '../utils/constants';
import './TagPalette.css';

/**
 * Human-friendly replacement for the raw `[laughter]`/`[question-ah]` tag
 * chips: each chip shows an emoji + a plain-language label (the literal
 * tag is still inserted on click, and stays visible in the button title
 * for power users who want to know exactly what will land in the text).
 */
export default function TagPalette({ onInsert }) {
  const { t } = useTranslation();

  return (
    <div className="tag-palette">
      <div className="tag-palette__header">
        <span className="tag-palette__title">{t('clone.tags.title')}</span>
        <InfoTip content={t('clone.tags.help')} />
      </div>
      {TAG_GROUPS.map(groupId => {
        const items = TAG_META.filter(m => m.group === groupId);
        if (items.length === 0) return null;
        return (
          <div key={groupId} className="tag-palette__group">
            <div className="tag-palette__group-title">{t(`clone.tags.group_${groupId}`)}</div>
            <div className="tags-container">
              {items.map(meta => (
                <button
                  key={meta.tag}
                  type="button"
                  className="tag-btn tag-btn--emoji"
                  title={meta.tag}
                  onClick={() => onInsert(meta.tag)}
                >
                  <span className="tag-btn__emoji" aria-hidden="true">{meta.emoji}</span>
                  <span className="tag-btn__label">{t(meta.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
