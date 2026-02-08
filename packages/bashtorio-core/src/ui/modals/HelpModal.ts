import { html } from 'lit-html';
import { BaseModal } from './BaseModal';

export class HelpModal extends BaseModal {
  template() {
    return html`
      <div class="modal-content help-modal-content">
        <h3>How It Works</h3>
        <div class="help-body">
          <h4>Unix Pipes: Connecting Programs</h4>
          <p>
            In Unix, a <strong>pipe</strong> connects the output of one program to the
            input of another. When you write <code>echo "hello" | tr a-z A-Z</code>,
            the shell creates an anonymous pipe &mdash; a small kernel buffer &mdash;
            between the two processes. <code>echo</code> writes bytes into one end,
            and <code>tr</code> reads them from the other. The data flows as a raw
            byte stream: no files on disk, no intermediate copies.
          </p>
          <pre><code class="help-diagram">  echo "hello"          tr a-z A-Z
       |                    ^
       |  ┌──────────────┐  |
       └─>│ kernel buffer │──┘
          └──────────────┘
            anonymous pipe</code></pre>
          <p>
            This is how the <code>|</code> operator works in every Unix shell. The kernel
            manages a fixed-size buffer (typically 64 KB on Linux). If the buffer fills up,
            the writing process blocks until the reader consumes some data. If the buffer is
            empty, the reader blocks until data arrives. This backpressure is what makes
            pipes efficient &mdash; no polling, no busy-waiting.
          </p>

          <h4>Named Pipes (FIFOs)</h4>
          <p>
            A <strong>named pipe</strong> (also called a FIFO) works exactly like an
            anonymous pipe, but it has a path on the filesystem. You create one with
            <code>mkfifo /tmp/mypipe</code>. Any process can then open that path for
            reading or writing &mdash; the kernel provides the same byte-stream buffer
            underneath.
          </p>
          <pre><code class="help-diagram">  # Terminal 1: read from the FIFO (blocks until data arrives)
  $ cat /tmp/mypipe

  # Terminal 2: write to the FIFO
  $ echo "hello" > /tmp/mypipe</code></pre>
          <p>
            Unlike anonymous pipes, FIFOs let <em>unrelated</em> processes communicate.
            Any program that knows the path can open it. The data still flows as a raw
            byte stream &mdash; first in, first out &mdash; and the same backpressure
            rules apply.
          </p>

          <h4>How Bashtorio Uses FIFOs</h4>
          <p>
            Bashtorio runs a real Linux system in your browser using the
            <a href="https://github.com/nicmcd/v86" target="_blank" rel="noopener" style="color: var(--ui-accent, #00d9ff);">v86</a>
            x86 emulator. Every Shell machine on the grid executes actual Unix commands
            inside this VM. There are two modes of operation:
          </p>
          <p>
            <strong>Pipe mode</strong> (default) &mdash; Each time a byte arrives at a Shell
            machine, the game pipes it into the command via stdin:
          </p>
          <pre><code class="help-diagram">  printf '%s' 'hello' | tr a-z A-Z</code></pre>
          <p>
            The command runs, produces output, and exits. The game collects the output and
            sends it downstream on the belt.
          </p>
          <p>
            <strong>Stream mode</strong> &mdash; The game creates a FIFO on the guest filesystem
            and starts the command reading from it. The command stays alive persistently, and
            incoming bytes are written into the FIFO as they arrive:
          </p>
          <pre><code class="help-diagram">  # What the VM does behind the scenes:
  mkfifo /tmp/bashtorio/s0_fifo

  # Start the command reading from the FIFO (stays alive):
  tr a-z A-Z <> /tmp/bashtorio/s0_fifo > /tmp/bashtorio/s0_out &

  # Each incoming byte gets written to the FIFO:
  printf '\\x68\\x65\\x6c\\x6c\\x6f' > /tmp/bashtorio/s0_fifo</code></pre>
          <p>
            The <code>&lt;&gt;</code> (read-write) open mode prevents the command from
            receiving EOF when the pipe empties &mdash; it keeps the process alive, waiting
            for more input. This is how stream-mode commands like <code>sed</code>,
            <code>awk</code>, or <code>cat</code> can process a continuous flow of data
            without restarting on every byte.
          </p>

          <h4>The VM Under the Hood</h4>
          <p>
            The v86 emulator runs a full x86 CPU in JavaScript/WebAssembly, booting a real
            Linux kernel with a real filesystem. Commands are sent to the guest via the
            emulated serial port, and output is collected either through a 9p shared
            filesystem or by parsing serial output markers.
          </p>
          <p>
            Each Shell machine gets its own shell session with an independent working
            directory. When you <code>cd</code> in one Shell machine, it doesn't affect
            the others &mdash; just like having multiple terminal windows open.
          </p>
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

customElements.define('bt-help-modal', HelpModal);
