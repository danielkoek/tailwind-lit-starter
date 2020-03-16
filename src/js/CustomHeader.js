import { LitElement, html } from "./web_modules/lit-element.js";
import tailwind from "./Style/tailwind.js";

export default class CustomHeader extends LitElement {
  static get styles() {
    return [tailwind];
  }
  static get properties() {
    return {};
  }
  render() {
    return html`
      <div class="container mx-auto">
        <h2>Hello world</h2>
        Let's get lit
      </div>
    `;
  }
}

customElements.define("custom-header", CustomHeader);
