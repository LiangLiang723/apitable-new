/**
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { IExpression, OperandTypeEnums } from 'automation_manager/interface';
import { MagicVariableParserABC } from 'automation_manager/interface/magic_variable.interface';

export class MagicVariableParser<T> extends MagicVariableParserABC<T> {
  // built-in functions
  sysFunctions: Function[];
  passFunctions: Function[];
  /**
   * A Map is used instead of a plain object: the operator name comes from the
   * parsed expression, and an object lookup would resolve `__proto__` or
   * `constructor` through the prototype chain and call into it.
   */
  sysFunctionMap: Map<string, Function>;
  /** The registered operator names, used to validate an operator before it is invoked. */
  sysFunctionNames: Set<string>;
  constructor(sysFunctions: Function[], passFunctions: Function[] = []) {
    super();
    this.sysFunctions = sysFunctions;
    this.passFunctions = passFunctions;
    this.sysFunctionMap = new Map<string, Function>();
    this.sysFunctionNames = new Set<string>();
    sysFunctions.forEach((func) => {
      this.sysFunctionMap.set(func.name, func);
      // compatible with user dirty data
      this.sysFunctionMap.set(func.name.toLowerCase(), func);
      this.sysFunctionNames.add(func.name);
      this.sysFunctionNames.add(func.name.toLowerCase());
    });
  }

  // clone and freeze globalContext to avoid mutation
  exec(expression: IExpression, _globalContext: T): any {
    const globalContext = Object.freeze(JSON.parse(JSON.stringify(_globalContext)));
    return this._exec(expression, globalContext);
  }

  // parse expression and return value
  _exec(expression: IExpression, globalContext: T): any {
    const operatorName = typeof expression.operator === 'string' ? expression.operator : '';
    // Only an operator that was registered by the caller may be invoked, a
    // random string from the parsed expression must never reach a call site.
    if (!this.sysFunctionNames.has(operatorName)) {
      throw Error(`${expression.operator} not implemented.`);
    }
    const operatorFunc = this.sysFunctionMap.get(operatorName);
    if (!operatorFunc) {
      throw Error(`${expression.operator} not implemented.`);
    }
    if (this.passFunctions.length && this.passFunctions.includes(operatorFunc)) {
      return null;
    }
    const { operands } = expression;
    const args = operands.map(operand => {
      if (typeof operand === 'string') {
        return operand;
      }
      if (operand.type === OperandTypeEnums.Literal) {
        return operand.value;
      }
      return this._exec(operand.value, globalContext);
    });
    // global context always pass as first argument
    return operatorFunc(globalContext, ...args);
  }
}
