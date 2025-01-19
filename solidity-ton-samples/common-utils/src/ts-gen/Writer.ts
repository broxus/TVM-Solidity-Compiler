import { trimIndent } from './text';

export class Writer {
    private indent = 0;

    private lines: string[] = [];

    depth() {
        return this.indent;
    }

    inIndent(handler: () => void) {
        this.indent += 1;
        handler();
        this.indent -= 1;
    };

    append(src: string = '') {
        if (src === '') this.lines.push('');
        else this.lines.push(' '.repeat(this.indent * 4) + src);
    }

    write(src: string) {
        const lines = trimIndent(src).split('\n');
        lines.forEach(l => this.append(l));
    }

    end() {
        return this.lines.join('\n');
    }
}
