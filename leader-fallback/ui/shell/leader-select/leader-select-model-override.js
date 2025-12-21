/**
 * @file leader-select-model-override.js
 * @description Leader Select Model Override: Override LeaderSelectModelManager methods to prevent 3D model loading for image leaders
 */

// 等待配置系统加载
function waitForConfig() {
	return new Promise((resolve) => {
		if (window.CustomLeaderConfig) {
			resolve();
			return;
		}
		
		let attempts = 0;
		const maxAttempts = 50; // 最多等待5秒
		const checkInterval = setInterval(() => {
			attempts++;
			if (window.CustomLeaderConfig) {
				clearInterval(checkInterval);
				resolve();
			} else if (attempts >= maxAttempts) {
				clearInterval(checkInterval);
				resolve(); // 即使失败也resolve，避免阻塞
			}
		}, 100);
	});
}

// 重写 showLeaderModels 函数
async function overrideShowLeaderModels() {
	await waitForConfig();
	
	try {
		// 动态导入 LeaderSelectModelManager
		const modelManagerModule = await import("/core/ui/shell/leader-select/leader-select-model-manager.chunk.js");
		const LeaderSelectModelManager = modelManagerModule.LeaderSelectModelManager || modelManagerModule.L;
		
		if (!LeaderSelectModelManager) {
			return false;
		}
		
		// 检查是否已经重写过
		if (LeaderSelectModelManager.showLeaderModels._isOverridden) {
			return true;
		}
		
		// 保存原始函数
		const originalShowLeaderModels = LeaderSelectModelManager.showLeaderModels.bind(LeaderSelectModelManager);
		
		// 重写函数
		LeaderSelectModelManager.showLeaderModels = function(leaderId) {
			// 检查是否为图片领袖
			if (window.CustomLeaderConfig && window.CustomLeaderConfig.isImageLeader(leaderId)) {
				
				// 对于图片领袖，我们需要：
				// 1. 激活相机（保持界面一致性）
				// 2. 清理之前的3D模型
				// 3. 加载底座（但不加载领袖3D模型）
				// 4. 图片覆盖层会在 swapLeaderInfo 中处理
				
				this.isVoPlaying = false;
				this.activateLeaderSelectCamera();
				
				// 清理之前的模型
				if (!this.isLeaderPicked && (leaderId == "" || this.currentLeaderAssetName == leaderId)) {
					return;
				}
				
				this.isLeaderPicked = false;
				this.leader3dMarker = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
				this.currentLeaderAssetName = leaderId;
				this.leaderSelectModelGroup?.clear();
				this.leaderPedestalModelGroup?.clear();
				this.leader3DModel = null;
				this._isRandomLeader = false;
				
				// 加载底座（参照原始代码）
				const isSmallAspectRatio = this.isSmallAspectRatio();
				// 通过构造函数访问类的静态属性
				const LeaderSelectModelManagerClass = this.constructor;
				const pedestalPosition = isSmallAspectRatio 
					? LeaderSelectModelManagerClass.PEDESTAL_CHOOSER_POSITION_SMALL_ASPECT_RATIO 
					: LeaderSelectModelManagerClass.PEDESTAL_CHOOSER_POSITION;
				
				// 加载光照场景（如果需要）
				if (this.leaderSelectModelGroup) {
					this.leaderSelectModelGroup.addModelAtPos(
						"LEADER_LIGHTING_SCENE_CHAR_SELECT_GAME_ASSET",
						{ x: 0, y: 0, z: 0 },
						{ angle: 0 }
					);
				}
				
				// 加载底座模型
				if (this.leaderPedestalModelGroup) {
					this.pedestal3DModel = this.leaderPedestalModelGroup.addModelAtPos(
						"LEADER_SELECTION_PEDESTAL",
						pedestalPosition,
						{ angle: 120, scale: 0.9 }
					);
				}
				
				// 不加载领袖3D模型，直接返回
				// 图片覆盖层会在 swapLeaderInfo 中处理
				return;
			}
			
			// 对于非图片领袖，正常调用原始函数
			return originalShowLeaderModels.call(this, leaderId);
		};
		
		// 标记已重写
		LeaderSelectModelManager.showLeaderModels._isOverridden = true;

		return true;
	} catch (error) {
		return false;
	}
}

// 重写 pickLeader 函数
async function overridePickLeader() {
	await waitForConfig();
	
	try {
		// 动态导入 LeaderSelectModelManager
		const modelManagerModule = await import("/core/ui/shell/leader-select/leader-select-model-manager.chunk.js");
		const LeaderSelectModelManager = modelManagerModule.LeaderSelectModelManager || modelManagerModule.L;
		
		if (!LeaderSelectModelManager) {
			return false;
		}
		
		// 检查是否已经重写过
		if (LeaderSelectModelManager.pickLeader._isOverridden) {
			return true;
		}
		
		// 保存原始函数
		const originalPickLeader = LeaderSelectModelManager.pickLeader.bind(LeaderSelectModelManager);
		
		// 重写函数
		LeaderSelectModelManager.pickLeader = function() {
			// 检查当前领袖是否为图片领袖
			if (window.CustomLeaderConfig && window.CustomLeaderConfig.isImageLeader(this.currentLeaderAssetName)) {
				
				// 对于图片领袖：
				// 1. 标记为已选择
				// 2. 清理领袖3D模型（但保留底座）
				// 3. 更新底座位置和缩放（参照原始代码的pickLeader逻辑）
				// 4. 跳过动画序列
				// 5. 处理相机切换（如果需要）
				
				this.isLeaderPicked = true;
				
				const isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
				if (this.isVoPlaying && performance.now() - this.sequenceStartTime < this.SEQUENCE_DEBOUNCE_DURATION) {
					console.warn(
						"Leader Model Manager: The leader picked sequence was triggered immediately after it was already triggered. requests to trigger it within the debounce duration will be ignored"
					);
					return;
				}
				this.sequenceStartTime = performance.now();
				
				// 清理领袖模型组（但不清理底座）
				this.leaderSelectModelGroup?.clear();
				this.leader3DModel = null;
				
				// 更新底座位置和缩放（参照原始代码）
				const isSmallAspectRatio = this.isSmallAspectRatio();
				// 通过构造函数访问类的静态属性
				const LeaderSelectModelManagerClass = this.constructor;
				const pedestalPosition = isSmallAspectRatio 
					? LeaderSelectModelManagerClass.PEDESTAL_POSITION_SMALL_ASPECT_RATIO 
					: LeaderSelectModelManagerClass.PEDESTAL_POSITION;
				const pedestalScale = isSmallAspectRatio 
					? LeaderSelectModelManagerClass.PEDESTAL_SCALE_SMALL_ASPECT_RATIO 
					: LeaderSelectModelManagerClass.PEDESTAL_SCALE;
				
				// 如果底座模型组存在，更新底座位置和缩放
				if (this.leaderPedestalModelGroup) {
					// 先清理旧的底座
					this.leaderPedestalModelGroup.clear();
					// 重新加载底座（使用pickLeader时的位置和缩放）
					this.pedestal3DModel = this.leaderPedestalModelGroup.addModelAtPos(
						"LEADER_SELECTION_PEDESTAL",
						pedestalPosition,
						pedestalScale
					);
				}
				
				// 对于图片领袖，不需要动画序列
				// 但可能需要处理相机切换
				if (!isMobileViewExperience) {
					// 可以保持当前相机或切换到确认视图的相机
					// 暂时保持当前相机
				}
				
				// 不调用原始函数，直接返回
				return;
			}
			
			// 对于非图片领袖，正常调用原始函数
			return originalPickLeader.call(this);
		};
		
		// 标记已重写
		LeaderSelectModelManager.pickLeader._isOverridden = true;

		return true;
	} catch (error) {
		return false;
	}
}

// 初始化函数
async function initializeModelOverride() {
	
	// 等待必要的模块加载
	await waitForConfig();
	
	// 等待 LeaderSelectModelManager 可用
	let attempts = 0;
	const maxAttempts = 50;
	const checkInterval = setInterval(async () => {
		attempts++;
		
		try {
			const modelManagerModule = await import("/core/ui/shell/leader-select/leader-select-model-manager.chunk.js");
			const LeaderSelectModelManager = modelManagerModule.LeaderSelectModelManager || modelManagerModule.L;
			
			if (LeaderSelectModelManager) {
				clearInterval(checkInterval);
				
				// 重写函数
				const success1 = await overrideShowLeaderModels();
				const success2 = await overridePickLeader();
				
				// Model override initialization completed
			}
		} catch (error) {
			// 模块可能还未加载，继续等待
		}
		
		if (attempts >= maxAttempts) {
			clearInterval(checkInterval);
		}
	}, 100);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeModelOverride);
} else {
	initializeModelOverride();
}

