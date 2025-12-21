/**
 * @file leader-select-panel-override.js
 * @description Leader Select Panel Override: Override swapLeaderInfo to show image overlay for image leaders
 */

// 使用公共工具函数
const waitForDependencies = window.PanelOverrideUtils?.waitForDependencies || (() => Promise.resolve());
const getCurrentLeaderID = window.PanelOverrideUtils?.getCurrentLeaderID || (async () => null);

// 恢复底座位置和相机（恢复到选择时的位置）
async function restorePedestalAndCamera() {
	try {
		const modelManagerModule = await import("/core/ui/shell/leader-select/leader-select-model-manager.chunk.js");
		const LeaderSelectModelManager = modelManagerModule.LeaderSelectModelManager || modelManagerModule.L;
		
		if (!LeaderSelectModelManager) {
			return;
		}
		
		// 检查是否为图片领袖
		const leaderID = await getCurrentLeaderID();
		if (!leaderID || !window.CustomLeaderConfig || !window.CustomLeaderConfig.isImageLeader(leaderID)) {
			return;
		}
		
		// 通过构造函数访问类的静态属性
		const LeaderSelectModelManagerClass = LeaderSelectModelManager.constructor;
		const isSmallAspectRatio = LeaderSelectModelManager.isSmallAspectRatio();
		
		// 使用showLeaderModels时的位置和缩放（选择时的位置）
		const pedestalPosition = isSmallAspectRatio 
			? LeaderSelectModelManagerClass.PEDESTAL_CHOOSER_POSITION_SMALL_ASPECT_RATIO 
			: LeaderSelectModelManagerClass.PEDESTAL_CHOOSER_POSITION;
		
		// 更新底座位置和缩放
		if (LeaderSelectModelManager.leaderPedestalModelGroup) {
			LeaderSelectModelManager.leaderPedestalModelGroup.clear();
			LeaderSelectModelManager.pedestal3DModel = LeaderSelectModelManager.leaderPedestalModelGroup.addModelAtPos(
				"LEADER_SELECTION_PEDESTAL",
				pedestalPosition,
				{ angle: 120, scale: 0.9 }
			);
		}
		
		// 恢复相机位置（使用showLeaderModels时的相机）
		if (LeaderSelectModelManager.zoomOutLeader) {
			LeaderSelectModelManager.zoomOutLeader();
		}
	} catch (error) {
		console.warn("Leader Select Panel Override: Failed to restore pedestal and camera", error);
	}
}

// 重写 swapLeaderInfo 函数
async function overrideSwapLeaderInfo() {
	await waitForDependencies();
	
	// 尝试通过 Controls 获取 LeaderSelectPanel 类定义
	const definition = Controls?.getDefinition?.("leader-select-panel");
	if (!definition || !definition.createInstance) {
		console.error("Leader Select Panel Override: Cannot find LeaderSelectPanel class definition");
		return false;
	}
	
	const LeaderSelectPanelClass = definition.createInstance;
	
	// 检查类是否有 swapLeaderInfo 方法
	if (!LeaderSelectPanelClass.prototype || !LeaderSelectPanelClass.prototype.swapLeaderInfo) {
		return false;
	}
	
	// 保存原始函数
	const originalSwapLeaderInfo = LeaderSelectPanelClass.prototype.swapLeaderInfo;
	
	// 检查是否已经重写过（避免重复重写）
	if (originalSwapLeaderInfo._isOverridden) {
		return true;
	}
	
	// 重写函数
	LeaderSelectPanelClass.prototype.swapLeaderInfo = function() {
		// 先调用原始函数，保持原有逻辑
		const result = originalSwapLeaderInfo.call(this);
		
		// 在原始函数执行后，检查是否为图片领袖并显示/移除覆盖层
		setTimeout(async () => {
			const leaderID = await getCurrentLeaderID();
			
			if (!leaderID) {
				// 如果没有领袖ID，移除所有可能的覆盖层（left, center, right）
				if (window.LeaderOverlayImage) {
					// 尝试移除所有可能位置的覆盖层
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "left");
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "center");
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "right");
				}
				return;
			}
			
			// 检查是否为图片领袖
			if (window.CustomLeaderConfig && window.CustomLeaderConfig.isImageLeader(leaderID)) {
				// 先移除旧的覆盖层（如果存在），然后创建新的
				if (window.LeaderOverlayImage) {
					// 从配置获取实际位置，用于清理旧的覆盖层
					let positionToRemove = "center"; // 默认值
					try {
						const displayConfig = window.CustomLeaderConfig.getImageDisplayConfig(leaderID, "leader-select");
						if (displayConfig && displayConfig.position) {
							positionToRemove = displayConfig.position;
						}
					} catch (configError) {
						// 如果获取配置失败，使用默认值
					}
					
					// 先移除旧的覆盖层（立即移除，无延迟）
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, positionToRemove);
					// 然后创建新的图片覆盖层（显式传递 panelType）
					// 传递leaderID和panelType，让图片覆盖层模块从配置系统获取图片路径和显示配置
					window.LeaderOverlayImage.tryCreateImageOverlay(this, 50, leaderID, "leader-select");
				}
			} else {
				// 不是图片领袖，移除所有可能的覆盖层（如果存在，立即移除）
				if (window.LeaderOverlayImage) {
					// 尝试移除所有可能位置的覆盖层
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "left");
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "center");
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "right");
				}
			}
		}, 50);
		
		return result;
	};
	
	// 标记已重写
	LeaderSelectPanelClass.prototype.swapLeaderInfo._isOverridden = true;
	
	console.log("Leader Select Panel Override: swapLeaderInfo function overridden");
	return true;
}

// 重写 onAttach 函数，在面板附加时恢复底座位置和相机
async function overrideOnAttach() {
	await waitForDependencies();
	
	// 尝试通过 Controls 获取 LeaderSelectPanel 类定义
	const definition = Controls?.getDefinition?.("leader-select-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const LeaderSelectPanelClass = definition.createInstance;
	
	// 检查类是否有 onAttach 方法
	if (!LeaderSelectPanelClass.prototype || !LeaderSelectPanelClass.prototype.onAttach) {
		return false;
	}
	
	// 保存原始函数
	const originalOnAttach = LeaderSelectPanelClass.prototype.onAttach;
	
	// 检查是否已经重写过（避免重复重写）
	if (originalOnAttach._isOverriddenForPedestal) {
		return true;
	}
	
	// 重写函数
	LeaderSelectPanelClass.prototype.onAttach = function() {
		const result = originalOnAttach.call(this);
		
		// 在面板附加后，恢复底座位置和相机（如果从后续界面返回）
		setTimeout(() => {
			restorePedestalAndCamera();
		}, 100);
		
		return result;
	};
	
	// 标记已重写
	originalOnAttach._isOverriddenForPedestal = true;
	
	console.log("Leader Select Panel Override: onAttach function overridden");
	return true;
}

// 重写 onDetach 函数，在面板退出时清理图片覆盖层
async function overrideOnDetach() {
	await waitForDependencies();
	
	// 尝试通过 Controls 获取 LeaderSelectPanel 类定义
	const definition = Controls?.getDefinition?.("leader-select-panel");
	if (!definition || !definition.createInstance) {
		console.error("Leader Select Panel Override: Cannot find LeaderSelectPanel class definition for onDetach");
		return false;
	}
	
	const LeaderSelectPanelClass = definition.createInstance;
	
	// 检查类是否有 onDetach 方法
	if (!LeaderSelectPanelClass.prototype || !LeaderSelectPanelClass.prototype.onDetach) {
		return false;
	}
	
	// 保存原始函数
	const originalOnDetach = LeaderSelectPanelClass.prototype.onDetach;
	
	// 检查是否已经重写过（避免重复重写）
	if (originalOnDetach._isOverridden) {
		return true;
	}
	
	// 重写函数
	LeaderSelectPanelClass.prototype.onDetach = function() {
		// 检查是否要切换到后续界面（age-select, civ-select, game-setup）
		// 如果是切换到后续界面，不应该清理覆盖层，因为后续界面需要继续使用
		// 使用延迟检查，因为面板状态可能在onDetach调用时还没有更新
		setTimeout(() => {
			const agePanel = document.querySelector("age-select-panel");
			const civPanel = document.querySelector("civ-select-panel");
			const gameSetupPanel = document.querySelector("game-setup-panel");
			
			// 检查是否有后续界面正在显示或即将显示
			const isSwitchingToNextPanel = (
				(agePanel && agePanel.offsetParent !== null && !agePanel.hasAttribute("hidden")) ||
				(civPanel && civPanel.offsetParent !== null && !civPanel.hasAttribute("hidden")) ||
				(gameSetupPanel && gameSetupPanel.offsetParent !== null && !gameSetupPanel.hasAttribute("hidden"))
			);
			
			// 只有在真正退出到主菜单时才清理图片覆盖层
			// 如果切换到后续界面，保留覆盖层，让后续界面调整大小
			if (!isSwitchingToNextPanel && window.LeaderOverlayImage) {
				// 移除所有可能位置的shell界面覆盖层（不是外交界面）
				const possiblePositions = ["left", "center", "right"];
				for (const position of possiblePositions) {
					const overlayClassName = `leader-overlay-image-block${position !== "center" ? `-${position}` : ""}`;
					const overlayBlock = document.body.querySelector(`.${overlayClassName}`);
					if (overlayBlock && !overlayBlock.className.includes("diplomacy")) {
						try {
							overlayBlock.remove();
						} catch (removeError) {
							console.warn(`[Leader Select Panel] Failed to remove overlay block on detach (position: ${position}):`, removeError);
						}
					}
				}
			}
		}, 50); // 延迟50ms检查，确保面板状态已更新
		
		// 调用原始函数，保持原有逻辑
		return originalOnDetach.call(this);
	};
	
	// 标记已重写
	LeaderSelectPanelClass.prototype.onDetach._isOverridden = true;
	
	console.log("Leader Select Panel Override: onDetach function overridden");
	return true;
}

// 初始化函数
async function initializePanelOverride() {
	
	// 等待依赖加载
	await waitForDependencies();
	
	// 等待 Controls 对象和 LeaderSelectPanel 类可用
	const checkControls = setInterval(async () => {
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			const definition = Controls.getDefinition("leader-select-panel");
			if (definition && definition.createInstance) {
				clearInterval(checkControls);
				
				// 确保类已完全加载
				setTimeout(async () => {
					const success1 = await overrideSwapLeaderInfo();
					const success2 = await overrideOnDetach();
					const success3 = await overrideOnAttach();
					if (!success1 && !success2 && !success3) {
						return;
					}
				}, 200);
			}
		}
	}, 100);
	
	// 最多等待10秒
	setTimeout(() => {
		clearInterval(checkControls);
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			Promise.all([
				overrideSwapLeaderInfo(),
				overrideOnDetach()
			]).then(([success1, success2]) => {
				if (!success1 && !success2) {
					console.error("Leader Select Panel Override: Initialization failed - Cannot find LeaderSelectPanel");
				}
			});
		}
	}, 10000);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializePanelOverride);
} else {
	initializePanelOverride();
}

