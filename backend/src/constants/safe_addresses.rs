use std::collections::HashMap;

pub struct SafeAddressRegistry;

impl SafeAddressRegistry {
    pub fn delegate_call_whitelist() -> HashMap<&'static str, &'static str> {
        let mut m = HashMap::new();
        m.insert("0x40A2aCCbd92BCA938b02010E17A5b8929b49130D", "MultiSendCallOnly v1.3.0 (canonical)");
        m.insert("0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B", "MultiSendCallOnly v1.3.0 (eip155)");
        m.insert("0xf220D3b4DFb23C4ade8C88E526C1353AbAcbC38F", "MultiSendCallOnly v1.3.0 (zksync)");
        m.insert("0x9641d764fc13c8B624c04430C7356C1C7C8102e2", "MultiSendCallOnly v1.4.1 (canonical)");
        m.insert("0x0408EF011960d02349d50286D20531229BCef773", "MultiSendCallOnly v1.4.1 (zksync)");
        m.insert("0x526643F69b81B008F46d95CD5ced5eC0edFFDaC6", "SafeMigration v1.4.1 (canonical)");
        m.insert("0x817756C6c555A94BCEE39eB5a102AbC1678b09A7", "SafeMigration v1.4.1 (zksync)");
        m.insert("0xA65387F16B013cf2Af4605Ad8aA5ec25a2cbA3a2", "SignMessageLib v1.3.0 (canonical)");
        m.insert("0x98FFBBF51bb33A056B08ddf711f289936AafF717", "SignMessageLib v1.3.0 (eip155)");
        m.insert("0x357147caf9C0cCa67DfA0CF5369318d8193c8407", "SignMessageLib v1.3.0 (zksync)");
        m.insert("0xd53cd0aB83D845Ac265BE939c57F53AD838012c9", "SignMessageLib v1.4.1 (canonical)");
        m.insert("0xAca1ec0a1A575CDCCF1DC3d5d296202Eb6061888", "SignMessageLib v1.4.1 (zksync)");
        m
    }

    pub fn canonical_factories() -> HashMap<&'static str, &'static str> {
        let mut m = HashMap::new();
        m.insert("0x76E2cFc1F5Fa8F6a5b3fC4c8F4788F0116861F9B", "Safe: Proxy Factory 1.1.1");
        m.insert("0x50e55Af101C777bA7A3d560a2aAB3b64D6b2b6A5", "Safe: Proxy Factory 1.3.0+");
        m.insert("0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2", "Safe: Proxy Factory 1.3.0");
        m.insert("0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67", "Safe: Proxy Factory 1.4.1");
        m.insert("0xC22834581EbC8527d974F8a1c97E1bEA4EF910BC", "Safe: Proxy Factory 1.4.1+");
        m.insert("0x12302fE9c02ff50939BaAaaf415fc226C078613C", "Safe: Proxy Factory 1.3.0 (L2)");
        m.insert("0x0000000000FFe8B47B3e2130213B802212439497", "Safe: Proxy Factory (Legacy)");
        m.insert("0x8942595A2dC5181Df0465AF0D7be08c8f23C93af", "Safe: Proxy Factory 1.1.1 (Legacy)");
        m
    }

    pub fn canonical_mastercopies() -> HashMap<&'static str, &'static str> {
        let mut m = HashMap::new();
        m.insert("0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552", "Safe: Master Copy 1.3.0 (canonical)");
        m.insert("0x69f4D1788e39c87893C980c06EdF4b7f686e2938", "Safe: Master Copy 1.3.0 (eip155/zksync)");
        m.insert("0xB00ce5CCcdEf57e539ddcEd01DF43a13855d9910", "Safe: Master Copy 1.3.0 (zksync)");
        m.insert("0x3E5c63644E683549055b9Be8653de26E0B4CD36E", "Safe: Master Copy 1.3.0 L2 (canonical)");
        m.insert("0xfb1bffC9d739B8D520DaF37dF666da4C687191EA", "Safe: Master Copy 1.3.0 L2 (eip155)");
        m.insert("0x1727c2c531cf966f902E5927b98490fDFb3b2b70", "Safe: Master Copy 1.3.0 L2 (zksync)");
        m.insert("0x41675C099F32341bf84BFc5382aF534df5C7461a", "Safe: Master Copy 1.4.1 (canonical)");
        m.insert("0x29fcB43b46531BcA003ddC8FCB67FFE91900C762", "Safe: Master Copy 1.4.1 L2 (canonical)");
        m.insert("0x6851D6fDFAfD08c0295C392436245E5bc78B0185", "Safe: Master Copy 1.2.0");
        m.insert("0xAE32496491b53841efb51829d6f886387708F99B", "Safe: Master Copy 1.1.1");
        m.insert("0xb6029EA3B2c51D09a50B53CA8012FeEB05bDa35A", "Safe: Master Copy 1.0.0");
        m.insert("0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F", "Safe: Master Copy 1.3.0+ (fallback)");
        m
    }

    pub fn canonical_initializers() -> HashMap<&'static str, &'static str> {
        let mut m = HashMap::new();
        m.insert("0x0000000000000000000000000000000000000000", "No Custom Initialization");
        m
    }

    pub fn canonical_fallback_handlers() -> HashMap<&'static str, &'static str> {
        let mut m = HashMap::new();
        m.insert("0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99", "Safe: Compatibility Fallback Handler 1.4.1");
        m.insert("0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4", "Safe: Compatibility Fallback Handler 1.3.0 (canonical)");
        m.insert("0x017062a1dE2FE6b99BE3d9d37841FeD19F573804", "Safe: Compatibility Fallback Handler 1.3.0 (eip155)");
        m.insert("0x2f870a80647BbC554F3a0EBD093f11B4d2a7492A", "Safe: Compatibility Fallback Handler 1.3.0 (zksync)");
        m.insert("0x1AC114C2099aFAf5261731655Dc6c306bFcd4Dbd", "Safe: Fallback Handler 1.3.0 (deprecated)");
        m.insert("0x0000000000000000000000000000000000000000", "No Fallback Handler");
        m
    }

    pub fn is_canonical_factory(address: &str) -> Option<&'static str> {
        let addr_lower = address.to_lowercase();
        Self::canonical_factories()
            .iter()
            .find(|(key, _)| key.to_lowercase() == addr_lower)
            .map(|(_, name)| *name)
    }

    pub fn is_canonical_mastercopy(address: &str) -> Option<&'static str> {
        let addr_lower = address.to_lowercase();
        Self::canonical_mastercopies()
            .iter()
            .find(|(key, _)| key.to_lowercase() == addr_lower)
            .map(|(_, name)| *name)
    }

    pub fn is_canonical_initializer(address: &str) -> Option<&'static str> {
        let addr_lower = address.to_lowercase();
        Self::canonical_initializers()
            .iter()
            .find(|(key, _)| key.to_lowercase() == addr_lower)
            .map(|(_, name)| *name)
    }

    pub fn is_canonical_fallback_handler(address: &str) -> Option<&'static str> {
        let addr_lower = address.to_lowercase();
        Self::canonical_fallback_handlers()
            .iter()
            .find(|(key, _)| key.to_lowercase() == addr_lower)
            .map(|(_, name)| *name)
    }

    pub fn is_trusted_delegate_call_target(address: &str) -> Option<&'static str> {
        let addr_lower = address.to_lowercase();
        Self::delegate_call_whitelist()
            .iter()
            .find(|(key, _)| key.to_lowercase() == addr_lower)
            .map(|(_, name)| *name)
    }
}
