import { html } from 'lit-html';
import { BaseModal } from './BaseModal';

export class ManualModal extends BaseModal {
  template() {
    return html`
      <div class="modal-content help-modal-content">
        <h3>Controls Reference</h3>
        <div class="help-body">

          <h4>Modes</h4>
          <table class="manual-table">
            <tr><td><kbd>1</kbd></td><td>Select mode - click machines to configure</td></tr>
            <tr><td><kbd>2</kbd></td><td>Erase mode - click to delete cells</td></tr>
            <tr><td><kbd>3</kbd></td><td>Place mode - click to place current machine/belt</td></tr>
          </table>

          <h4>Grid Controls</h4>
          <table class="manual-table">
            <tr><td>Left click</td><td>Place / select / erase (depends on mode)</td></tr>
            <tr><td>Right click</td><td>Erase cell</td></tr>
            <tr><td><kbd>Ctrl</kbd> + drag</td><td>Pan the camera</td></tr>
            <tr><td>Scroll wheel</td><td>Zoom in / out</td></tr>
            <tr><td><kbd>R</kbd></td><td>Rotate placement direction</td></tr>
            <tr><td><kbd>Space</kbd></td><td>Start / stop simulation</td></tr>
            <tr><td><kbd>E</kbd></td><td>Open machine picker</td></tr>
          </table>

          <h4>Machine Shortcuts <span style="opacity:0.5">(in Place mode)</span></h4>
          <table class="manual-table">
            <tr><td><kbd>Q</kbd></td><td>Belt</td></tr>
            <tr><td><kbd>W</kbd></td><td>Splitter</td></tr>
            <tr><td><kbd>F</kbd></td><td>Shell</td></tr>
            <tr><td><kbd>S</kbd></td><td>Sink</td></tr>
            <tr><td><kbd>A</kbd></td><td>Display</td></tr>
            <tr><td><kbd>X</kbd></td><td>Null</td></tr>
            <tr><td><kbd>C</kbd></td><td>Linefeed</td></tr>
            <tr><td><kbd>V</kbd></td><td>Flipper</td></tr>
            <tr><td><kbd>D</kbd></td><td>Duplicator</td></tr>
            <tr><td><kbd>T</kbd></td><td>Constant</td></tr>
            <tr><td><kbd>G</kbd></td><td>Filter</td></tr>
            <tr><td><kbd>N</kbd></td><td>Counter</td></tr>
            <tr><td><kbd>B</kbd></td><td>Delay</td></tr>
            <tr><td><kbd>K</kbd></td><td>Keyboard</td></tr>
            <tr><td><kbd>P</kbd></td><td>Packer</td></tr>
            <tr><td><kbd>U</kbd></td><td>Unpacker</td></tr>
            <tr><td><kbd>H</kbd></td><td>Router</td></tr>
            <tr><td><kbd>I</kbd></td><td>Gate</td></tr>
            <tr><td><kbd>J</kbd></td><td>Wireless</td></tr>
            <tr><td><kbd>L</kbd></td><td>Replace</td></tr>
            <tr><td><kbd>M</kbd></td><td>Math</td></tr>
            <tr><td><kbd>O</kbd></td><td>Clock</td></tr>
            <tr><td><kbd>Y</kbd></td><td>Latch</td></tr>
            <tr><td><kbd>Z</kbd></td><td>7-Segment</td></tr>
          </table>

          <h4>Simulation Input</h4>
          <table class="manual-table">
            <tr><td><kbd>⌨️</kbd> button</td><td>Enter keyboard passthrough - keystrokes go to Keyboard machines</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Exit passthrough mode</td></tr>
          </table>

        </div>
        <div class="help-footer">
          <button data-cancel class="primary">Close</button>
        </div>
      </div>
    `;
  }

  open() {
    this.show();
  }
}

customElements.define('bt-manual-modal', ManualModal);
