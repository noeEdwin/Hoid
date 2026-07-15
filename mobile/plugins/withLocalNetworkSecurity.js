const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");

const NETWORK_SECURITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">192.168.3.11</domain>
  </domain-config>
</network-security-config>
`;

function withLocalNetworkSecurity(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application["$"] = {
        ...application["$"],
        "android:networkSecurityConfig": "@xml/network_security_config",
      };
    }
    return mod;
  });

  return withDangerousMod(config, ["android", async (mod) => {
    const resourceDirectory = path.join(
      mod.modRequest.platformProjectRoot,
      "app/src/main/res/xml"
    );
    fs.mkdirSync(resourceDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(resourceDirectory, "network_security_config.xml"),
      NETWORK_SECURITY_XML
    );
    return mod;
  }]);
}

module.exports = withLocalNetworkSecurity;
