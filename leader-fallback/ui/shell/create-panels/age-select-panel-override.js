/**
 * @file age-select-panel-override.js
 * @description Age Select Panel Override: Adjust image overlay position and size for age selection panel
 */

// 使用公共工具函数
const waitForDependencies = window.PanelOverrideUtils?.waitForDependencies || (() => Promise.resolve());
const getCurrentLeaderID = window.PanelOverrideUtils?.getCurrentLeaderID || (async () => null);

// 更新底座位置和相机（从选择时的位置切换到选择后的位置）
async function updatePedestalAndCamera() {
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
		
		// 使用pickLeader时的位置和缩放（选择后的位置）
		const pedestalPosition = isSmallAspectRatio 
			? LeaderSelectModelManagerClass.PEDESTAL_POSITION_SMALL_ASPECT_RATIO 
			: LeaderSelectModelManagerClass.PEDESTAL_POSITION;
		const pedestalScale = isSmallAspectRatio 
			? LeaderSelectModelManagerClass.PEDESTAL_SCALE_SMALL_ASPECT_RATIO 
			: LeaderSelectModelManagerClass.PEDESTAL_SCALE;
		
		// 更新底座位置和缩放
		if (LeaderSelectModelManager.leaderPedestalModelGroup) {
			LeaderSelectModelManager.leaderPedestalModelGroup.clear();
			LeaderSelectModelManager.pedestal3DModel = LeaderSelectModelManager.leaderPedestalModelGroup.addModelAtPos(
				"LEADER_SELECTION_PEDESTAL",
				pedestalPosition,
				pedestalScale
			);
		}
		
		// 改变相机位置（使用pickLeader时的相机）
		const isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
		if (!isMobileViewExperience && LeaderSelectModelManager.zoomInLeader) {
			LeaderSelectModelManager.zoomInLeader();
		}
	} catch (error) {
		console.warn("Age Select Panel Override: Failed to update pedestal and camera", error);
	}
}

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
		console.warn("Age Select Panel Override: Failed to restore pedestal and camera", error);
	}
}

// 调整图片覆盖层以适应时代选择面板
async function adjustOverlayForAgePanel() {
	const leaderID = await getCurrentLeaderID();
	
	if (!leaderID || !window.CustomLeaderConfig || !window.CustomLeaderConfig.isImageLeader(leaderID)) {
		return;
	}
	
	// 调整覆盖层位置和大小
	if (window.LeaderOverlayImage?.adjustOverlayForPanel) {
		window.LeaderOverlayImage.adjustOverlayForPanel(leaderID, "age-select");
	}
}

// 重写 onAttach 方法
async function overrideOnAttach() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("age-select-panel");
	if (!definition || !definition.createInstance) {
		console.error("Age Select Panel Override: Cannot find AgeSelectPanel class definition");
		return false;
	}
	
	const AgeSelectPanelClass = definition.createInstance;
	
	if (!AgeSelectPanelClass.prototype || !AgeSelectPanelClass.prototype.onAttach) {
		console.error("Age Select Panel Override: AgeSelectPanel does not have onAttach method");
		return false;
	}
	
	const originalOnAttach = AgeSelectPanelClass.prototype.onAttach;
	
	// 检查是否已经重写过
	if (originalOnAttach._isOverridden) {
		return true;
	}
	
	AgeSelectPanelClass.prototype.onAttach = function() {
		const result = originalOnAttach.call(this);
		
		// 在面板附加后，更新底座位置和相机，并调整图片覆盖层
		setTimeout(() => {
			updatePedestalAndCamera();
			adjustOverlayForAgePanel();
		}, 100);
		
		return result;
	};
	
	originalOnAttach._isOverridden = true;
	
	return true;
}

// 重写 selectAge 方法（当选择时代时也可能需要调整）
async function overrideSelectAge() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("age-select-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const AgeSelectPanelClass = definition.createInstance;
	
	if (!AgeSelectPanelClass.prototype || !AgeSelectPanelClass.prototype.selectAge) {
		return false;
	}
	
	const originalSelectAge = AgeSelectPanelClass.prototype.selectAge;
	
	if (originalSelectAge._isOverridden) {
		return true;
	}
	
	AgeSelectPanelClass.prototype.selectAge = function(ageButton) {
		const result = originalSelectAge.call(this, ageButton);
		
		// 选择时代后，调整图片覆盖层（以防容器大小变化）
		setTimeout(() => {
			adjustOverlayForAgePanel();
		}, 50);
		
		return result;
	};
	
	originalSelectAge._isOverridden = true;
	
	return true;
}

// 重写 onDetach 方法，在退出时代选择面板时恢复底座位置和相机
async function overrideOnDetach() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("age-select-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const AgeSelectPanelClass = definition.createInstance;
	
	if (!AgeSelectPanelClass.prototype || !AgeSelectPanelClass.prototype.onDetach) {
		return false;
	}
	
	const originalOnDetach = AgeSelectPanelClass.prototype.onDetach;
	
	if (originalOnDetach._isOverriddenForPedestal) {
		return true;
	}
	
	AgeSelectPanelClass.prototype.onDetach = function() {
		// 检查是否要返回到领袖选择界面
		const leaderPanel = document.querySelector("leader-select-panel");
		const isReturningToLeaderSelect = (
			leaderPanel && leaderPanel.offsetParent !== null && !leaderPanel.hasAttribute("hidden")
		);
		
		// 如果返回到领袖选择界面，恢复底座位置和相机
		if (isReturningToLeaderSelect) {
			setTimeout(() => {
				restorePedestalAndCamera();
			}, 50);
		}
		
		return originalOnDetach.call(this);
	};
	
	originalOnDetach._isOverriddenForPedestal = true;
	
	return true;
}

// 重写 updateLeaderBox 方法（当更新领袖盒子时也可能需要调整）
async function overrideUpdateLeaderBox() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("age-select-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const AgeSelectPanelClass = definition.createInstance;
	
	// 检查类是否有 updateLeaderBox 方法（可能在基类中）
	if (!AgeSelectPanelClass.prototype || !AgeSelectPanelClass.prototype.updateLeaderBox) {
		// 如果没有，尝试从基类获取
		try {
			const GameCreationPanelBaseModule = await import("/core/ui/shell/create-panels/game-creation-panel-base.chunk.js");
			const GameCreationPanelBase = GameCreationPanelBaseModule.GameCreationPanelBase;
			
			if (!GameCreationPanelBase || !GameCreationPanelBase.prototype || !GameCreationPanelBase.prototype.updateLeaderBox) {
				return false;
			}
			
			const originalUpdateLeaderBox = GameCreationPanelBase.prototype.updateLeaderBox;
			
			if (originalUpdateLeaderBox._isOverriddenForAgePanel) {
				return true;
			}
			
			GameCreationPanelBase.prototype.updateLeaderBox = function() {
				const result = originalUpdateLeaderBox.call(this);
				
				// 检查当前面板是否是时代选择面板
				if (this instanceof AgeSelectPanelClass) {
					// 更新领袖盒子后，调整图片覆盖层
					setTimeout(() => {
						adjustOverlayForAgePanel();
					}, 50);
				}
				
				return result;
			};
			
			originalUpdateLeaderBox._isOverriddenForAgePanel = true;

			return true;
		} catch (error) {
			console.warn("Age Select Panel Override: Failed to override updateLeaderBox", error);
			return false;
		}
	}
	
	// 如果类本身有 updateLeaderBox 方法，直接重写
	const originalUpdateLeaderBox = AgeSelectPanelClass.prototype.updateLeaderBox;
	
	if (originalUpdateLeaderBox._isOverridden) {
		return true;
	}
	
	AgeSelectPanelClass.prototype.updateLeaderBox = function() {
		const result = originalUpdateLeaderBox.call(this);
		
		// 更新领袖盒子后，调整图片覆盖层
		setTimeout(() => {
			adjustOverlayForAgePanel();
		}, 50);
		
		return result;
	};
	
	originalUpdateLeaderBox._isOverridden = true;
	
	return true;
}

// 初始化函数
async function initializeAgePanelOverride() {
	console.log("Age Select Panel Override: Initialization started");
	
	await waitForDependencies();
	
	const checkControls = setInterval(async () => {
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			const definition = Controls.getDefinition("age-select-panel");
			if (definition && definition.createInstance) {
				clearInterval(checkControls);
				
				setTimeout(async () => {
					const success1 = await overrideOnAttach();
					const success2 = await overrideSelectAge();
					const success3 = await overrideUpdateLeaderBox();
					const success4 = await overrideOnDetach();
					
					if (success1 || success2 || success3 || success4) {
						console.log("Age Select Panel Override: Initialization successful");
					}
				}, 200);
			}
		}
	}, 100);
	
		setTimeout(() => {
			clearInterval(checkControls);
			if (typeof Controls !== "undefined" && Controls.getDefinition) {
				overrideOnAttach();
				overrideSelectAge();
				overrideUpdateLeaderBox();
				overrideOnDetach();
			}
		}, 10000);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeAgePanelOverride);
} else {
	initializeAgePanelOverride();
}

