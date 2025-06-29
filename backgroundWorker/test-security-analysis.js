#!/usr/bin/env node

/**
 * Test script for the security analysis functionality
 * 
 * This script tests various transaction scenarios to verify
 * that the security analysis correctly identifies suspicious activities.
 */

const securityAnalysisService = require('./src/services/securityAnalysisService');

// Test transactions with various security concerns
const testTransactions = [
  {
    name: "Normal ETH transfer",
    transaction: {
      safeTxHash: "0x123...",
      to: "0x742d35Cc6634C0532925a3b8D400B9b7d1f4C3aA",
      value: "1000000000000000000", // 1 ETH
      data: "0x",
      operation: 0,
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      gasPrice: "0"
    }
  },
  {
    name: "Gas token attack (custom token + receiver)",
    transaction: {
      safeTxHash: "0x456...",
      to: "0x742d35Cc6634C0532925a3b8D400B9b7d1f4C3aA",
      value: "1000000000000000000",
      data: "0x",
      operation: 0,
      gasToken: "0xA0b86a33E6441041A6B5a1E5b2b6D4B6",
      refundReceiver: "0xB0b86a33E6441041A6B5a1E5b2b6D4B7",
      gasPrice: "20000000000" // 20 gwei
    }
  },
  {
    name: "Untrusted delegate call",
    transaction: {
      safeTxHash: "0x789...",
      to: "0x1234567890123456789012345678901234567890", // Unknown address
      value: "0",
      data: "0x1234",
      operation: 1, // Delegate call
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      gasPrice: "0"
    }
  },
  {
    name: "Trusted delegate call (MultiSendCallOnly)",
    transaction: {
      safeTxHash: "0xabc...",
      to: "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D", // MultiSendCallOnly v1.3.0
      value: "0",
      data: "0x1234",
      operation: 1, // Delegate call
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      gasPrice: "0"
    }
  },
  {
    name: "Large value transfer",
    transaction: {
      safeTxHash: "0xdef...",
      to: "0x742d35Cc6634C0532925a3b8D400B9b7d1f4C3aA",
      value: "150000000000000000000", // 150 ETH
      data: "0x",
      operation: 0,
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      gasPrice: "0"
    }
  },
  {
    name: "Owner removal",
    transaction: {
      safeTxHash: "0x111...",
      to: "0x1234567890123456789012345678901234567890",
      value: "0",
      data: "0x1234",
      operation: 0,
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      gasPrice: "0",
      dataDecoded: {
        method: "removeOwner",
        parameters: [
          { name: "prevOwner", value: "0x1111111111111111111111111111111111111111" },
          { name: "owner", value: "0x2222222222222222222222222222222222222222" },
          { name: "_threshold", value: "2" }
        ]
      }
    }
  },
  {
    name: "Zero gas price with gas token",
    transaction: {
      safeTxHash: "0x222...",
      to: "0x742d35Cc6634C0532925a3b8D400B9b7d1f4C3aA",
      value: "1000000000000000000",
      data: "0x",
      operation: 0,
      gasToken: "0xA0b86a33E6441041A6B5a1E5b2b6D4B6", // Custom gas token
      refundReceiver: "0x0000000000000000000000000000000000000000",
      gasPrice: "0" // Zero gas price
    }
  }
];

function runSecurityAnalysisTests() {
  console.log('🔒 Running Security Analysis Tests\n');
  console.log('=' + '='.repeat(60) + '\n');

  let totalTests = 0;
  let suspiciousCount = 0;

  testTransactions.forEach((test, index) => {
    totalTests++;
    console.log(`Test ${index + 1}: ${test.name}`);
    console.log('-'.repeat(40));
    
    try {
      const analysis = securityAnalysisService.analyzeTransaction(test.transaction, "0x1234567890123456789012345678901234567890");
      
      console.log(`Risk Level: ${analysis.riskLevel.toUpperCase()}`);
      console.log(`Suspicious: ${analysis.isSuspicious ? 'YES' : 'NO'}`);
      
      if (analysis.isSuspicious) {
        suspiciousCount++;
      }
      
      if (analysis.warnings.length > 0) {
        console.log(`Warnings: ${analysis.warnings.join(', ')}`);
      }
      
      if (analysis.details.length > 0) {
        console.log('Details:');
        analysis.details.forEach(detail => {
          console.log(`  • [${detail.severity.toUpperCase()}] ${detail.message}`);
        });
      }
      
      const summary = securityAnalysisService.generateSummary(analysis);
      console.log(`Summary: ${summary}`);
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
    
    console.log('\n');
  });

  console.log('=' + '='.repeat(60));
  console.log('📊 Test Results Summary');
  console.log('=' + '='.repeat(60));
  console.log(`Total tests: ${totalTests}`);
  console.log(`Suspicious transactions detected: ${suspiciousCount}`);
  console.log(`Normal transactions: ${totalTests - suspiciousCount}`);
  console.log(`Detection rate: ${((suspiciousCount / totalTests) * 100).toFixed(1)}%`);
  
  // Expected results validation
  const expectedSuspicious = [
    "Gas token attack (custom token + receiver)",
    "Untrusted delegate call", 
    "Large value transfer",
    "Owner removal"
  ];
  
  console.log('\n🎯 Expected vs Actual Results:');
  testTransactions.forEach((test, index) => {
    const shouldBeSuspicious = expectedSuspicious.includes(test.name);
    const analysis = securityAnalysisService.analyzeTransaction(test.transaction, "0x1234567890123456789012345678901234567890");
    const isSuspicious = analysis.isSuspicious;
    
    const status = shouldBeSuspicious === isSuspicious ? '✅' : '❌';
    console.log(`${status} ${test.name}: Expected ${shouldBeSuspicious ? 'SUSPICIOUS' : 'NORMAL'}, Got ${isSuspicious ? 'SUSPICIOUS' : 'NORMAL'}`);
  });
}

// Run the tests
if (require.main === module) {
  runSecurityAnalysisTests();
}

module.exports = { runSecurityAnalysisTests };