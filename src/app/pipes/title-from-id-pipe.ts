import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'titleFromId',
})
export class TitleFromIdPipe implements PipeTransform {
  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }
}
