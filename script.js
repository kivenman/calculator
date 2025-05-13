document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calculator-form');
    const resultsContainer = document.getElementById('results');
    const stepsTbody = document.getElementById('steps-tbody');
    const finalAvgPriceSpan = document.getElementById('final-avg-price');
    const totalMarginSpan = document.getElementById('total-margin');
    const finalUnrealizedPnlSpan = document.getElementById('final-unrealized-pnl');
    const liquidationPriceSpan = document.getElementById('liquidation-price');
    const liqDiffPercentSpan = document.getElementById('liq-diff-percent');
    const priceDiffPercentSpan = document.getElementById('price-diff-percent');
    const finalTpProfitSpan = document.getElementById('final-tp-profit');

    form.addEventListener('submit', (e) => {
        e.preventDefault(); // 阻止表单默认提交行为
        calculateMartingale();
    });

    function calculateMartingale() {
        // --- 获取输入 --- 
        const direction = document.getElementById('direction').value; // 'long' or 'short'
        const initialPrice = parseFloat(document.getElementById('initial-price').value);
        const addDiffPercent = parseFloat(document.getElementById('add-diff-percent').value);
        const tpPercent = parseFloat(document.getElementById('tp-percent').value);
        const initialMargin = parseFloat(document.getElementById('initial-margin').value);
        const addMarginBase = parseFloat(document.getElementById('add-margin').value);
        const maxAdds = parseInt(document.getElementById('max-adds').value);
        const leverage = parseFloat(document.getElementById('leverage').value);
        const amountMultiplier = parseFloat(document.getElementById('amount-multiplier').value);
        const diffMultiplier = parseFloat(document.getElementById('diff-multiplier').value);

        // --- 输入验证 --- 
        if (isNaN(initialPrice) || initialPrice <= 0 ||
            isNaN(addDiffPercent) || addDiffPercent <= 0 ||
            isNaN(tpPercent) || tpPercent <= 0 ||
            isNaN(initialMargin) || initialMargin <= 0 ||
            isNaN(addMarginBase) || addMarginBase <= 0 ||
            isNaN(maxAdds) || maxAdds < 0 ||
            isNaN(leverage) || leverage < 1 ||
            isNaN(amountMultiplier) || amountMultiplier <= 0 ||
            isNaN(diffMultiplier) || diffMultiplier <= 0) {
            alert('请输入所有有效的正数参数（杠杆倍数至少为1）！');
            return;
        }

        // --- 初始化变量 --- 
        stepsTbody.innerHTML = ''; // 清空旧结果
        let totalMargin = initialMargin;
        let totalQuantity = (initialMargin * leverage) / initialPrice;
        let totalValue = totalQuantity * initialPrice; // 初始总价值等于 初始保证金 * 杠杆
        let currentAvgPrice = initialPrice;
        let cumulativeDiffPercent = 0;
        let lastAddPrice = initialPrice;
        let lastTpProfit = 0;

        // --- 记录初始仓位 (序号 0) --- 
        const initialQuantity = totalQuantity; // 在循环前获取初始数量
        const initialTpPrice = initialPrice * (1 + (direction === 'long' ? tpPercent : -tpPercent) / 100);
        const calculatedInitialTpProfit = initialQuantity * Math.abs(initialTpPrice - initialPrice);
        let initialPercentToTp = 0;
        if (initialPrice !== 0) {
             initialPercentToTp = ((initialTpPrice - initialPrice) / initialPrice) * 100;
        }

        const initialRow = stepsTbody.insertRow();
        initialRow.innerHTML = `
            <td>0</td>
            <td>${initialPrice.toFixed(6)}</td>
            <td>${initialQuantity.toFixed(4)}</td>
            <td>${initialMargin.toFixed(2)}</td>
            <td>0.00</td> <!-- 初始未实现盈亏 -->
            <td>${initialPrice.toFixed(6)}</td> <!-- 初始均价 -->
            <td>${initialTpPrice.toFixed(6)}</td>
            <td>${calculatedInitialTpProfit.toFixed(2)}</td>
            <td>${initialPercentToTp.toFixed(2)}%</td>
        `;

        // --- 循环计算加仓 --- 
        for (let i = 1; i <= maxAdds; i++) {
            // 计算本次加仓保证金
            const currentAddMargin = addMarginBase * Math.pow(amountMultiplier, i - 1);

            // 计算本次加仓触发价差百分比
            const stepDiffPercent = addDiffPercent * Math.pow(diffMultiplier, i - 1);
            cumulativeDiffPercent += stepDiffPercent;

            // 计算本次理论委托价
            let currentAddPrice;
            if (direction === 'long') {
                currentAddPrice = initialPrice * (1 - cumulativeDiffPercent / 100);
            } else { // short
                currentAddPrice = initialPrice * (1 + cumulativeDiffPercent / 100);
            }
            lastAddPrice = currentAddPrice; // 记录最后一次加仓价格

            // 价格不能小于等于0
            if (currentAddPrice <= 0) {
                 const row = stepsTbody.insertRow();
                 row.innerHTML = `<td colspan="7" style="text-align:center; color: red;">错误：计算出的加仓价格 (${currentAddPrice.toFixed(8)}) 无效，停止计算后续加仓。</td>`;
                 break; // 停止计算
            }

            // 计算本次加仓数量
            const currentAddQuantity = (currentAddMargin * leverage) / currentAddPrice;

            // 更新累计值
            totalMargin += currentAddMargin;
            const previousTotalQuantity = totalQuantity;
            totalQuantity += currentAddQuantity;
            totalValue = (previousTotalQuantity * currentAvgPrice) + (currentAddQuantity * currentAddPrice);
            currentAvgPrice = totalValue / totalQuantity;

            // 新增：计算本次加仓完成时的未实现盈亏
            let stepUnrealizedPnl = 0;
            if (direction === 'long') {
                stepUnrealizedPnl = totalQuantity * (currentAddPrice - currentAvgPrice);
            } else { // short
                stepUnrealizedPnl = totalQuantity * (currentAvgPrice - currentAddPrice);
            }

            // 计算本次止盈价
            let currentTpPrice;
            if (direction === 'long') {
                currentTpPrice = currentAvgPrice * (1 + tpPercent / 100);
            } else { // short
                currentTpPrice = currentAvgPrice * (1 - tpPercent / 100);
            }

            // 计算本次止盈收益
            const currentTpProfit = totalQuantity * Math.abs(currentTpPrice - currentAvgPrice);
            lastTpProfit = currentTpProfit; // 记录最后一次止盈收益

            // 新增：计算距止盈需要的百分比 (基于加仓价)
            let percentToTp = 0;
            if (currentAddPrice !== 0) { 
                percentToTp = ((currentTpPrice - currentAddPrice) / currentAddPrice) * 100;
            }

            // --- 显示本次加仓结果 (修改小数位数) --- 
            const row = stepsTbody.insertRow();
            row.innerHTML = `
                <td>${i}</td>
                <td>${currentAddPrice.toFixed(6)}</td>
                <td>${currentAddQuantity.toFixed(4)}</td>
                <td>${currentAddMargin.toFixed(2)}</td>
                <td>${stepUnrealizedPnl.toFixed(2)}</td>
                <td>${currentAvgPrice.toFixed(6)}</td>
                <td>${currentTpPrice.toFixed(6)}</td>
                <td>${currentTpProfit.toFixed(2)}</td>
                <td>${percentToTp.toFixed(2)}%</td>
            `;
        }

        // --- 计算最终概要 --- 
        let finalUnrealizedPnl = 0;
        let estimatedLiqPrice = NaN; // 初始化爆仓价

        if (totalQuantity > 0) { // 确保有持仓
             if (maxAdds > 0) { // 确保有加仓发生才能计算最后加仓时的未实现盈亏
                 if (direction === 'long') {
                     finalUnrealizedPnl = totalQuantity * (lastAddPrice - currentAvgPrice);
                 } else { // short
                     finalUnrealizedPnl = totalQuantity * (currentAvgPrice - lastAddPrice);
                 }
             }

            // 计算简化爆仓价
             if (direction === 'long') {
                 // 估算爆仓价 ≈ 平均成本 - (总保证金 / 总数量)
                 estimatedLiqPrice = currentAvgPrice - (totalMargin / totalQuantity);
             } else { // short
                 // 估算爆仓价 ≈ 平均成本 + (总保证金 / 总数量)
                 estimatedLiqPrice = currentAvgPrice + (totalMargin / totalQuantity);
             }
        }

        // --- 显示最终概要 (修改小数位数) --- 
        finalAvgPriceSpan.textContent = totalQuantity > 0 ? currentAvgPrice.toFixed(6) : initialPrice.toFixed(6);
        totalMarginSpan.textContent = totalMargin.toFixed(2);
        finalUnrealizedPnlSpan.textContent = finalUnrealizedPnl.toFixed(2);

        // 计算并显示首尾价差百分比
        let priceDiffPercentValue = 0;
        if (maxAdds > 0 && initialPrice !== 0 && lastAddPrice !== initialPrice) { // 确保有加仓且价格不同
            priceDiffPercentValue = ((lastAddPrice - initialPrice) / initialPrice) * 100;
            priceDiffPercentSpan.textContent = `${priceDiffPercentValue.toFixed(2)}%`;
        } else if (maxAdds <= 0) {
             priceDiffPercentSpan.textContent = 'N/A (无加仓)';
        } else {
            priceDiffPercentSpan.textContent = '0.00%'; // 加仓了但价格未变（理论上不可能，除非差价为0）
        }

        if (!isNaN(estimatedLiqPrice) && estimatedLiqPrice > 0) {
             liquidationPriceSpan.textContent = `约 ${estimatedLiqPrice.toFixed(6)} USDT (简化估算)`;
             liquidationPriceSpan.style.color = '#e74c3c';

            // 新增：计算并显示距爆仓价差百分比
            if (currentAvgPrice !== 0) {
                const priceDiffToLiq = estimatedLiqPrice - currentAvgPrice;
                const liqDiffPercentValue = (priceDiffToLiq / currentAvgPrice) * 100;
                liqDiffPercentSpan.textContent = `${liqDiffPercentValue.toFixed(2)}%`;
                // 根据做多做空调整颜色，通常爆仓价在不利方向
                liqDiffPercentSpan.style.color = (direction === 'long' && liqDiffPercentValue < 0) || (direction === 'short' && liqDiffPercentValue > 0) ? '#e74c3c' : '#2ecc71';
            } else {
                liqDiffPercentSpan.textContent = 'N/A';
                liqDiffPercentSpan.style.color = '#777';
            }

        } else if (!isNaN(estimatedLiqPrice) && estimatedLiqPrice <= 0) {
             liquidationPriceSpan.textContent = `理论上已低于0 (简化估算)`;
             liquidationPriceSpan.style.color = '#e74c3c';
            liqDiffPercentSpan.textContent = 'N/A (爆仓价无效)';
            liqDiffPercentSpan.style.color = '#777';
        } else {
             liquidationPriceSpan.textContent = '无法计算 (无持仓)';
             liquidationPriceSpan.style.color = '#777'; // 恢复默认颜色
            liqDiffPercentSpan.textContent = 'N/A';
            liqDiffPercentSpan.style.color = '#777';
        }
        finalTpProfitSpan.textContent = maxAdds > 0 ? lastTpProfit.toFixed(2) : calculatedInitialTpProfit.toFixed(2);

        resultsContainer.style.display = 'block'; // 显示结果区域
         // 平滑滚动到结果区域
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    // --- 新增：导出图片功能 --- 
    const exportButton = document.getElementById('export-image-btn');
    exportButton.addEventListener('click', () => {
        const elementToCapture = document.querySelector('.calculator-container'); // 或者更精确的元素
        if (!elementToCapture) {
            alert('无法找到要导出的元素。');
            return;
        }

        // 确保结果是可见的，否则图片可能不完整
        const resultsAreVisible = resultsContainer.style.display === 'block';
        if (!resultsAreVisible) {
            alert('请先进行计算，使结果可见后再导出。');
            return;
        }

        // 使用 html2canvas
        html2canvas(elementToCapture, {
            useCORS: true, // 如果有跨域图片，尝试使用
            // scale: window.devicePixelRatio, // 可以提高清晰度，但文件会变大
            logging: true, // 开启日志，方便调试
            onclone: (document) => {
                // 可以在克隆的文档上做一些临时的样式修改，比如确保所有内容都可见
                // 例如，如果结果区域有自己的滚动条，可能需要临时移除
            }
        }).then(canvas => {
            // --- 新增：构建动态文件名 --- 
            const direction = document.getElementById('direction').value;
            const initialPrice = parseFloat(document.getElementById('initial-price').value);
            const addDiffPercent = parseFloat(document.getElementById('add-diff-percent').value);
            const tpPercent = parseFloat(document.getElementById('tp-percent').value);
            // const initialMargin = parseFloat(document.getElementById('initial-margin').value); // 文件名通常不包含保证金
            // const addMarginBase = parseFloat(document.getElementById('add-margin').value);
            const maxAdds = parseInt(document.getElementById('max-adds').value);
            const leverage = parseFloat(document.getElementById('leverage').value);
            const amountMultiplier = parseFloat(document.getElementById('amount-multiplier').value);
            const diffMultiplier = parseFloat(document.getElementById('diff-multiplier').value);

            // 格式化文件名中的数值，保留一定小数位或取整
            const formatNum = (num, decimals = 2) => isNaN(num) ? 'NaN' : num.toFixed(decimals);
            const formatInt = (num) => isNaN(num) ? 'NaN' : parseInt(num);

            // 拼接文件名 (示例，可以根据需要调整)
            const filename = `Martingale_${direction === 'long' ? 'Long' : 'Short'}` +
                             `_P${formatNum(initialPrice, 6)}` +
                             `_Diff${formatNum(addDiffPercent)}` +
                             `_TP${formatNum(tpPercent)}` +
                             `_N${formatInt(maxAdds)}` +
                             `_L${formatInt(leverage)}x` +
                             `_AM${formatNum(amountMultiplier)}` +
                             `_DM${formatNum(diffMultiplier)}` +
                             `.png`;
            // 替换可能存在的文件名非法字符 (虽然这里主要是数字和下划线，但做个保险)
            const safeFilename = filename.replace(/[\/\\:*?"<>|]/g, '_');

            // 创建一个链接元素
            const link = document.createElement('a');
            // 修改：使用动态文件名
            link.download = safeFilename; 
            link.href = canvas.toDataURL('image/png');
            
            // 触发下载
            document.body.appendChild(link); // 需要将链接添加到DOM中才能在某些浏览器中工作
            link.click();
            document.body.removeChild(link); // 清理

        }).catch(err => {
            console.error('导出图片失败:', err);
            alert('导出图片失败，请查看控制台获取更多信息。');
        });
    });

}); 