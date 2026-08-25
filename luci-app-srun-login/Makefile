include $(TOPDIR)/rules.mk

LUCI_TITLE:=SRUN Campus Network Login
LUCI_DEPENDS:=+python3 +python3-requests +libustream-openssl
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-srun-login
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(TOPDIR)/feeds/luci/luci.mk

$(eval $(call BuildPackage,luci-app-srun-login))
