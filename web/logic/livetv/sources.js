/**
 * Live TV Sources Compatibility Bridge
 * =====================================
 * Bridges the legacy PRESET_SOURCES dictionary to the modern OOP Catalogs & SourceManager.
 * Retains existing contract for backward compatibility across the application.
 */

import { REGIONAL_CATALOG } from './catalogs/regional-sources.js';
import { SourceManager, sourceManager } from './core/source-manager.js';
import { Channel } from './core/channel.js';

export const PRESET_SOURCES = REGIONAL_CATALOG.reduce((acc, item) => {
    acc[item.id] = {
        name: item.name,
        url: item.url,
        category: item.category,
        priority: item.priority
    };
    return acc;
}, {});

export { SourceManager, sourceManager, Channel, REGIONAL_CATALOG };
