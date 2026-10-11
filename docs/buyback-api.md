# Buyback shortcut adapter

Contracts inspected in Portal frontend sources on October 11, 2026:

- `https://portal.ubreakifix.net/assets/ubif-boh.js`: product container `data-testid="store-product-container"`; inventory `GET /api/boh/store-products/:sku/inventory` with `pageSize`, one-based `page`, `searchTerm`, `warehouseType`, `warehouseId`; response `value` and `@odata.count`. Inventory rows carry `SerialNumber` and `SerialStatus`.
- `https://portal.ubreakifix.net/assets/ubif-types.js`: warehouse default `Store`, status `Sold`.
- R92.4 `ubif-util-store.js` / `ubif-components.js` cached source: native item detail uses `GET /api/boh/inventory/:serial`; response includes `ItemNumber`, `SerialStatus`, `SalesOrderNumber`, `WorkOrderId`. Work order navigation is `/repair/workorder/:id`.
- Current `https://portal.ubreakifix.net/assets/ubif-repair.js` source: mounted cart Table data contains `item.subtext` from `getSkuOrSerial` and `actions` with `id="print_buyback_label"`, `isDisabled`, and `onPress`. The native callback owns printer selection, reprinting, barcode generation, and adding buyback cart lines. This extension invokes that callback once instead of duplicating those writes.

Buttons appear inline beside item and sold serial search results. Item clicks load current-store inventory only on demand; sold serial clicks use the exact search serial. The `searchBuyback` setting defaults to true and cancels pending lookups when disabled. The former product-page panel has been removed. Search result row DOM survives remaining category responses so the chooser stays attached to its result.

The MAIN-world adapter reads only current ancestor props of mounted tables. It matches the serial exactly, normalizing a bare ten-digit serial or `I-` prefix to the selected SKU. Multiple matching actions fail closed. Disabled actions wait up to 30 seconds for Portal to load; unsupported/rework-only actions remain native. An action is consumed before invocation and never retried automatically, including when an exception occurs.

Tests simulate pagination, sale/SKU validation, navigation races, current React props, ambiguity, disabled guards, intent expiry, cancellation, and single invocation. No production label was generated or physically printed during implementation. Portal's authenticated response shapes, current work order/cart markup, native action visibility and Dymo output require a live check.
