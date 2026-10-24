/**
 * Reading chart colours out of CSS.
 *
 * The stylesheet owns the palette; the canvas just consumes it. Two things
 * make that less direct than it sounds:
 *
 *   1. `getPropertyValue()` on a custom property returns the declared token
 *      stream, so a `color-mix()` expression comes back unresolved.
 *   2. Canvas does not reliably parse `color-mix()`, so passing the raw
 *      string to `fillStyle` would be a gamble.
 *
 * Assigning the value to a real colour property on a hidden element and
 * reading that back makes the browser compute it to `rgb(...)`, which canvas
 * accepts everywhere.
 */

/**
 * Resolve a CSS colour to a canvas-safe string.
 *
 * Returns `fallback` if the value is empty or the browser cannot parse it.
 */
export function resolveColour(raw: string, fallback: string): string {
    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.color = raw;

    // An unparseable value leaves the inline style empty.
    if (!probe.style.color) return fallback;

    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();

    return resolved || fallback;
}

/**
 * Read a list of custom properties, pairing each with a fallback used when the
 * stylesheet is missing or the value cannot be parsed.
 */
export function readColours(
    names: readonly string[],
    fallbacks: readonly string[]
): string[] {
    const root = getComputedStyle(document.documentElement);

    return names.map((name, i) => {
        const raw = root.getPropertyValue(name).trim();
        return raw ? resolveColour(raw, fallbacks[i]!) : fallbacks[i]!;
    });
}