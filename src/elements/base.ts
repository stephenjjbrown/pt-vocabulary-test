/**
 * Base class for all views.
 *
 * Shadow DOM is disabled so the global `style.css` keeps working.
 *
 * `observe()` is the bridge between the model and the view: the callback
 * reads whatever signals the view renders, which registers them as
 * dependencies, and the returned disposer must be called when the view
 * disconnects. This is the same idea as `@lit-labs/signals`, but built on
 * stable core `@preact/signals-core` instead of an experimental labs
 * package.
 */

import { LitElement } from 'lit';
import { effect } from '@preact/signals-core';

export class LightElement extends LitElement {
    private cleanups: Array<() => void> = [];

    protected override createRenderRoot(): HTMLElement {
        return this;
    }

    /**
     * Run `fn` now and again whenever any signal it reads changes.
     * Callbacks are torn down automatically on disconnect.
     */
    protected observe(fn: () => void): void {
        const dispose = effect(fn);
        this.cleanups.push(dispose);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        for (const dispose of this.cleanups) dispose();
        this.cleanups = [];
    }
}