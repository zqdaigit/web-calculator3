(function () {
  const STORAGE_KEY = "ws22-prototype-history";
  const THEME_KEY = "ws22-prototype-theme";
  const operators = ["+", "-", "*", "/"];
  const labels = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  const formulaDisplay = document.getElementById("formulaDisplay");
  const resultDisplay = document.getElementById("resultDisplay");
  const historyList = document.getElementById("historyList");
  const displayTip = document.getElementById("displayTip");
  const toast = document.getElementById("toast");
  const themeIcon = document.getElementById("themeIcon");

  const state = {
    tokens: [],
    current: "0",
    justCalculated: false,
    lastOperation: null,
    operatorCount: 0,
    blockedEnterCount: 0,
    history: loadHistory()
  };

  initTheme();
  bindEvents();
  render();
  renderHistory();

  function bindEvents() {
    document.querySelector(".keypad").addEventListener("click", (event) => {
      const button = event.target.closest(".key");
      if (!button) return;
      activate(button);
      handleButton(button);
    });
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("keyup", handleKeyup);
    document.getElementById("themeToggle").addEventListener("click", toggleTheme);
    document.getElementById("clearHistory").addEventListener("click", clearHistory);
  }

  function handleButton(button) {
    if (button.dataset.number) inputNumber(button.dataset.number);
    if (button.dataset.operator) inputOperator(button.dataset.operator);
    if (button.dataset.action === "decimal") inputDecimal();
    if (button.dataset.action === "equals") calculate();
    if (button.dataset.action === "clear") clearAll();
    if (button.dataset.action === "clear-entry") clearEntry();
    if (button.dataset.action === "backspace") backspace();
    if (button.dataset.action === "toggle-sign") toggleSign();
  }

  function handleKeydown(event) {
    if (event.repeat) return;
    const button = findVirtualKey(event.key);
    if (!button) return;
    event.preventDefault();
    button.classList.add("active");
    handleButton(button);
    window.setTimeout(() => button.classList.remove("active"), 100);
  }

  function handleKeyup(event) {
    const button = findVirtualKey(event.key);
    if (button) button.classList.remove("active");
  }

  function findVirtualKey(key) {
    if (/^[0-9]$/.test(key)) return document.querySelector(`[data-number="${key}"]`);
    if (key === ".") return document.querySelector('[data-action="decimal"]');
    if (key === "Enter" || key === "=") return document.querySelector('[data-action="equals"]');
    if (key === "Backspace") return document.querySelector('[data-action="backspace"]');
    if (key === "Escape" || key === "Delete") return document.querySelector('[data-action="clear"]');
    const mapped = key.toLowerCase() === "x" ? "*" : key;
    if (operators.includes(mapped)) return document.querySelector(`[data-operator="${mapped}"]`);
    return null;
  }

  function inputNumber(value) {
    if (state.justCalculated) resetInput();
    state.current = state.current === "0" ? value : state.current + value;
    state.blockedEnterCount = 0;
    render();
  }

  function inputDecimal() {
    if (state.justCalculated) resetInput();
    if (state.current.includes(".")) return;
    state.current = state.current === "" ? "0." : `${state.current}.`;
    render();
  }

  function inputOperator(operator) {
    if (state.justCalculated) {
      state.tokens = [state.current, operator];
      state.current = "";
      state.justCalculated = false;
    } else if (operators.includes(state.tokens[state.tokens.length - 1]) && state.current === "") {
      state.tokens[state.tokens.length - 1] = operator;
    } else {
      state.tokens.push(state.current || "0", operator);
      state.current = "";
    }
    state.operatorCount = countOperators(state.tokens);
    state.blockedEnterCount = 0;
    render();
  }

  function calculate() {
    if (state.operatorCount === 0 && !state.lastOperation) {
      state.blockedEnterCount += 1;
      if (state.blockedEnterCount > 3) showTip();
      return;
    }

    const expression = [...state.tokens];
    if (state.current !== "") expression.push(state.current);
    if (operators.includes(expression[expression.length - 1])) {
      expression.push(expression[expression.length - 2]);
    } else if (state.operatorCount === 0 && state.lastOperation) {
      expression.push(state.lastOperation.operator, state.lastOperation.value);
    }
    if (countOperators(expression) === 0) return;

    const value = evaluate(expression);
    if (value === null) {
      showToast("不能除以 0");
      return;
    }
    const result = formatNumber(value);
    const displayExpression = formatExpression(expression);
    state.lastOperation = extractLastOperation(expression);
    state.tokens = [];
    state.current = result;
    state.operatorCount = 0;
    state.justCalculated = true;
    state.blockedEnterCount = 0;
    addHistory(displayExpression, result);
    formulaDisplay.textContent = `${displayExpression} =`;
    render(true);
  }

  function evaluate(tokens) {
    const values = [];
    const ops = [];
    for (const token of tokens) {
      if (!operators.includes(token)) {
        values.push(Number(token));
        continue;
      }
      while (ops.length && precedence(ops[ops.length - 1]) >= precedence(token)) {
        if (!apply(values, ops)) return null;
      }
      ops.push(token);
    }
    while (ops.length) {
      if (!apply(values, ops)) return null;
    }
    return values[0];
  }

  function apply(values, ops) {
    const right = values.pop();
    const left = values.pop();
    const operator = ops.pop();
    if (operator === "/" && right === 0) return false;
    if (operator === "+") values.push(left + right);
    if (operator === "-") values.push(left - right);
    if (operator === "*") values.push(left * right);
    if (operator === "/") values.push(left / right);
    return true;
  }

  function precedence(operator) { return operator === "*" || operator === "/" ? 2 : 1; }
  function countOperators(tokens) { return tokens.filter((token) => operators.includes(token)).length; }
  function formatExpression(tokens) { return tokens.map((token) => labels[token] || token).join(" "); }
  function formatNumber(value) { return String(Number.parseFloat(Number(value).toPrecision(12))); }

  function extractLastOperation(tokens) {
    for (let index = tokens.length - 2; index >= 0; index -= 1) {
      if (operators.includes(tokens[index])) return { operator: tokens[index], value: tokens[index + 1] };
    }
    return null;
  }

  function toggleSign() {
    if (!state.current || state.current === "0") return;
    state.current = state.current.startsWith("-") ? state.current.slice(1) : `-${state.current}`;
    render();
  }

  function backspace() {
    if (state.current === "" && operators.includes(state.tokens[state.tokens.length - 1])) {
      state.tokens.pop();
      state.current = state.tokens.pop() || "0";
    } else {
      state.current = state.current.length > 1 ? state.current.slice(0, -1) : "0";
    }
    state.operatorCount = countOperators(state.tokens);
    render();
  }

  function clearEntry() { state.current = "0"; state.justCalculated = false; render(); }
  function clearAll() { state.lastOperation = null; resetInput(); render(); }
  function resetInput() {
    state.tokens = [];
    state.current = "0";
    state.justCalculated = false;
    state.operatorCount = 0;
    state.blockedEnterCount = 0;
  }

  function render(keepFormula) {
    if (!keepFormula) {
      const expression = formatExpression([...state.tokens, state.current].filter(Boolean));
      formulaDisplay.textContent = expression || "准备计算";
    }
    resultDisplay.textContent = state.current || state.tokens[state.tokens.length - 2] || "0";
  }

  function addHistory(expression, result) {
    state.history.unshift({ expression, result });
    state.history = state.history.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    renderHistory();
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (error) { return []; }
  }

  function renderHistory() {
    if (!state.history.length) {
      historyList.innerHTML = '<div class="history-empty">暂无计算历史<br>完成算式后会显示在这里</div>';
      return;
    }
    historyList.innerHTML = state.history.map((item) =>
      `<div class="history-item"><div class="history-expression">${item.expression} =</div><div class="history-result">${item.result}</div></div>`
    ).join("");
  }

  function clearHistory() {
    state.history = [];
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    showToast("历史记录已清空");
  }

  function showTip() {
    displayTip.classList.add("visible");
    window.setTimeout(() => displayTip.classList.remove("visible"), 2000);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.setTimeout(() => toast.classList.remove("visible"), 1800);
  }

  function activate(button) {
    button.classList.add("active");
    window.setTimeout(() => button.classList.remove("active"), 100);
  }

  function initTheme() {
    document.body.classList.toggle("dark", localStorage.getItem(THEME_KEY) === "dark");
    themeIcon.textContent = document.body.classList.contains("dark") ? "☾" : "☀";
  }

  function toggleTheme() {
    document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
    themeIcon.textContent = document.body.classList.contains("dark") ? "☾" : "☀";
  }
})();
