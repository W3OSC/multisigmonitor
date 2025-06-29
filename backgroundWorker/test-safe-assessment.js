const safeAssessment = require('./src/services/safeSecurityAssessmentService.js');

console.log('🔍 Testing Safe Security Assessment Service...');

async function testAssessment() {
  try {
    // Test with a well-known Safe address
    const safeAddress = '0x849D52316331967b6fF1198e5E32A0eB168D039d';
    const network = 'ethereum';
    
    console.log(`\nTesting assessment for Safe: ${safeAddress} on ${network}`);
    
    const assessment = await safeAssessment.assessSafeSecurity(safeAddress, network);
    
    console.log('\n📊 Assessment Results:');
    console.log('Overall Risk:', assessment.overallRisk);
    console.log('Security Score:', assessment.securityScore + '/100');
    console.log('Risk Factors:', assessment.riskFactors.length);
    
    console.log('\n🔍 Check Results:');
    Object.entries(assessment.checks).forEach(([check, result]) => {
      if (result && result.isValid !== undefined) {
        console.log(`  ${check}: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`);
      } else if (result && result.isCanonical !== undefined) {
        console.log(`  ${check}: ${result.isCanonical ? '✅ Canonical' : '⚠️ Unknown'}`);
      } else {
        console.log(`  ${check}: ${result ? '✅ OK' : '❌ Failed'}`);
      }
    });
    
    console.log('\n📋 Safe Details:');
    console.log('Creator:', assessment.details.creator || 'Unknown');
    console.log('Factory:', assessment.details.factory || 'Unknown');
    console.log('Mastercopy:', assessment.details.mastercopy || 'Unknown');
    console.log('Version:', assessment.details.version || 'Unknown');
    console.log('Owners:', assessment.details.owners.length);
    console.log('Threshold:', assessment.details.threshold);
    console.log('Modules:', assessment.details.modules.length);
    console.log('Nonce:', assessment.details.nonce);
    
    if (assessment.riskFactors.length > 0) {
      console.log('\n⚠️ Risk Factors:');
      assessment.riskFactors.forEach(factor => console.log('  -', factor));
    }
    
    console.log('\n✅ Safe Security Assessment test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n📝 Note: Some API calls may fail due to missing API keys or network issues.');
    console.log('This is expected in the development environment.');
  }
}

testAssessment();