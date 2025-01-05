const express = require('express');
const router = express.Router();
const pool = require('../utils/pool');
const generatePropertyUniqueId =  require('../middleware/schemeName')

router.post('/', generatePropertyUniqueId, (req, res) => {
  const formData = req.body; // Form data from the frontend
  const paymentHistory = formData.paymentHistory; // Array of payment history
  const serviceChargeHistory = formData.serviceChargeHistory; // Array of service charges


  // Step 1: Insert data into the property table
  const propertyQuery = `
    INSERT INTO property (
      serial_number, scheme_name, property_unique_id, allottee_name, fathers_husbands_name,
      permanent_address, current_address, mobile_number, property_category, property_number,
      registration_amount, registration_date, allotment_amount, allotment_date, sale_price,
      freehold_amount, lease_rent_amount, park_charge, corner_charge,
      remaining_sale_price_lump_sum, remaining_sale_price_installments, interest_amount, remaining_installment_date,
      area_square_meter, possession_date, additional_land_amount, restoration_charges,
      certificate_charges, registration_charges, registration_date_2,
      transfer_name, transferors_fathers_husbands_name, address, inheritance,
      transfer_fee, documentation_fee, transfer_date, building_plan_approval_date,
      building_construction, deposit_date, change_fee, advertisement_fee
    ) VALUES (?,? ,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const propertyValues = [
    formData["serialNumber"], formData["schemeName"], formData["propertyId"], formData["allotteName"],
    formData["fatherHusbandName"], formData["permanentAddress"], formData["currentAddress"],
    formData["mobileNumber"], formData["propertyCategory"], formData["propertyNumber"],
    formData["registrationAmount"], formData["registrationDate"], formData["allotmentAmount"],
    formData["allotmentDate"], formData["salePrice"], formData["freeholdAmount"],
    formData["leaseRentAmount"], formData["parkCharge"], formData["cornerCharge"],
    formData["remainingSalePriceLumpSum"], formData["remainingSalePriceInstallment"], formData["interestAmount"], 
    formData["remainingInstallmentDate"],
    formData["areaSquareMeter"], formData["possessionDate"], formData["additionalLandAmount"],
    formData["restorationCharges"], formData["certificateCharges"], 
    formData["registrationCharges"], formData["registrationDate2"], formData["transferName"],
    formData["transferorFatherHusbandName"], formData["transferorAddress"], formData["inheritance"],
    formData["transferCharges"], formData["documentationCharges"], formData["transferDate"],
    formData["buildingPlanApprovalDate"], formData["buildingConstruction"], formData["depositDateReceiptNumber"],
     formData["changeFee"], formData["advertisementFee"]
  ];

  pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
    if (err) {
      console.error("Error inserting property data:", err);
      return res.status(500).json({ message: "Error inserting property data into the database" , errorObj: err});
    }

    const propertyId = propertyResult.insertId; // ID of the inserted property

    // Step 2: Insert data into the installments table
    const installmentQuery = `
      INSERT INTO installments (
        property_id, installment_payment_amount, installment_interest_amount, delayed_interest_amount, installment_date
      ) VALUES (?, ?, ?, ?, ?)`;

    const installmentPromises = paymentHistory.map((installment) => {
      const installmentValues = [
        propertyId,
        installment.installmentAmount,
        installment.installmentInterest,
        installment.delayedInterestAmount,
        installment.installmentDate
      ];

      return new Promise((resolve, reject) => {
        pool.query(installmentQuery, installmentValues, (err, result) => {
          if (err) {
            console.error("Error inserting installment data:", err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });

    // Step 3: Insert data into the service charges table
    const serviceChargeQuery = `
      INSERT INTO service_charge (
        property_id, service_charge_financial_year, service_charge_amount, service_charges_late_fee, service_charges_date
      ) VALUES (?, ?, ?, ?, ?)`;

    const serviceChargePromises = serviceChargeHistory.map((serviceCharge) => {
      const serviceChargeValues = [
        propertyId,
        serviceCharge.financialYear,
        serviceCharge.amount,
        serviceCharge.lateFee,
        serviceCharge.date
      ];

      return new Promise((resolve, reject) => {
        pool.query(serviceChargeQuery, serviceChargeValues, (err, result) => {
          if (err) {
            console.error("Error inserting service charge data:", err);
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });

    // Step 4: Combine all promises and send response
    Promise.all([...installmentPromises, ...serviceChargePromises])
      .then(() => {
        res.status(200).json({
          message: "Data inserted successfully",
          propertyData: formData,
          paymentHistory,
          serviceChargeHistory
        });
      })
      .catch((err) => {
        console.error("Error inserting data:", err);
        res.status(500).json({ message: "Error inserting property data into the database" , errorObj: err});
      });
  });
});


router.get('/', (req, res) => {
  const query = `
    SELECT 
      p.*,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'installment_date', i.installment_date,
          'delayed_interest_amount', i.delayed_interest_amount,
          'installment_interest_amount', i.installment_interest_amount,
          'installment_payment_amount', i.installment_payment_amount
        )
      ) AS installments,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'service_charges_date', s.service_charges_date,
          'service_charges_late_fee', s.service_charges_late_fee,
          'service_charge_amount', s.service_charge_amount,
          'service_charge_financial_year', s.service_charge_financial_year
        )
      ) AS service_charges
    FROM 
      property p
    LEFT JOIN 
      installments i ON p.id = i.property_id
    LEFT JOIN 
      service_charge s ON p.id = s.property_id
    GROUP BY 
      p.id;
  `;

  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching data:', err);
      return res.status(500).send('Error fetching data from the database');
    }

    // Parse JSON strings into JavaScript arrays
    const formattedResults = results.map((row) => ({
      ...row,
      installments: JSON.parse(row.installments || '[]'),
      service_charges: JSON.parse(row.service_charges || '[]'),
    }));

    res.status(200).json({
      message: 'Data fetched successfully',
      data: formattedResults,
    });
  });
});



// first data from table
// router.get('/', (req, res) => {
//   const query = `
//     SELECT 
//   p.*,
//   i.installment_date, 
//   i.delayed_interest_amount, 
//   i.installment_interest_amount, 
//   i.installment_payment_amount,
//   s.service_charges_date, 
//   s.service_charges_late_fee, 
//   s.service_charge_amount, 
//   s.service_charge_financial_year
// FROM 
//   property p
// LEFT JOIN 
//   installments i ON p.id = i.property_id 
// LEFT JOIN 
//   service_charge s ON p.id = s.property_id; 
//   `;

//   pool.query(query, (err, results) => {
//     if (err) {
//       console.error('Error fetching data:', err);
//       return res.status(500).json({message: 'Error fetching data from the database' , errorMsg: err})
//     }

//     // Group data by property_id for a structured response
//     const groupedData = results.reduce((acc, row) => {
//       const propertyId = row.property_id;

//       if (!acc[propertyId]) {
//         acc[propertyId] = {
//           property: {
//             ...row,
//             property_id: propertyId,
//           },
//           installments: [],
//           serviceCharges: []
//         };
//       }

//       // Add installments data
//       if (row.installment_date) {
//         acc[propertyId].installments.push({
//           installment_date: row.installment_date,
//           delayed_interest_amount: row.delayed_interest_amount,
//           installment_interest_amount: row.installment_interest_amount,
//           installment_payment_amount: row.installment_payment_amount
//         });
//       }

//       // Add service charges data
//       if (row.installment_date) {
//         acc[propertyId].serviceCharges.push({
//           service_charges_date: row.service_charges_date,
//           service_charges_late_fee: row.service_charges_late_fee,
//           service_charge_amount: row.service_charge_amount,
//           service_charge_financial_year: row.service_charge_financial_year
//         });
//       }

//       return acc;
//     }, {});

//     // Convert grouped data object to an array
//     const responseData = Object.values(groupedData);

//     res.status(200).json({
//       message: 'Data fetched successfully',
//       data: responseData,
//     });
//   });
// });

// old get route
// router.get('/', (req, res) => {
//     const query = 'SELECT * FROM property';
  
//     pool.query(query, (err, results) => {
//       if (err) {
//         console.error('Error fetching data:', err);
//         return res.status(500).send('Error fetching data from the database');
//       }
  
//       res.status(200).json({
//         message: 'Data fetched successfully',
//         data: results,
//       });
//     });
//   });

module.exports = router;




// old code 

// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object
//   const paymentHistory = formData.paymentHistory; // Ensure this is an array of objects from the frontend

//   // Step 1: Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number, scheme_name, property_unique_id, allottee_name, fathers_husbands_name,
//       permanent_address, current_address, mobile_number, property_category, property_number,
//       registration_amount, registration_date, allotment_amount, allotment_date, sale_price,
//       freehold_amount, lease_rent_amount, park_charge, corner_charge,
//       remaining_sale_price_lump_sum, remaining_sale_price_installments, interest_amount,
//       area_square_meter, possession_date, additional_land_amount, restoration_charges,
//       certificate_charges, service_charges_financial_year, service_charges_amount,
//       service_charges_late_fee, service_charges_date, registration_charges, registration_date_2,
//       transfer_name, transferors_fathers_husbands_name, address, inheritance,
//       transfer_fee, documentation_fee, transfer_date, building_plan_approval_date,
//       building_construction, deposit_date, receipt_number, change_fee, advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"], formData["schemeName"], formData["propertyId"], formData["ownerName"],
//     formData["fatherName"], formData["permanentAddress"], formData["currentAddress"],
//     formData["mobileNumber"], formData["category"], formData["propertyNumber"],
//     formData["registrationAmount"], formData["registrationDate"], formData["allotmentAmount"],
//     formData["allotmentDate"], formData["salePrice"], formData["freeholdAmount"],
//     formData["leaseRent"], formData["parkCharge"], formData["cornerCharge"],
//     formData["remainingSalePrice"], formData["remainingInstallment"], formData["interestAmount"],
//     formData["area_square_meter"], formData["possession_date"], formData["additional_land_amount"],
//     formData["restoration_charges"], formData["certificate_charges"], formData["service_charges_financial_year"],
//     formData["service_charges_amount"], formData["service_charges_late_fee"], formData["service_charges_date"],
//     formData["registration_charges"], formData["registration_date_2"], formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"], formData["address"], formData["inheritance"],
//     formData["transfer_fee"], formData["documentation_fee"], formData["transfer_date"],
//     formData["building_plan_approval_date"], formData["building_construction"], formData["deposit_date"],
//     formData["receipt_number"], formData["change_fee"], formData["advertisement_fee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).send("Error inserting property data into the database");
//     }

//     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

//     // Step 2: Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id, installment_payment_amount, installment_interest_amount, delayed_interest_amount, installment_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     // Use a loop to iterate over the paymentHistory array
//     const installmentPromises = paymentHistory.map((installment) => {
//       const installmentValues = [
//         propertyId,
//         installment.installmentAmount,
//         installment.installmentInterest,
//         installment.delayedInterestAmount,
//         installment.installmentDate
//       ];

//       return new Promise((resolve, reject) => {
//         pool.query(installmentQuery, installmentValues, (err, result) => {
//           if (err) {
//             console.error("Error inserting installment data:", err);
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//     });

//     Promise.all(installmentPromises)
//       .then(() => {
//         res.status(200).json({
//           message: "Data inserted successfully",
//           propertyData: formData,
//           paymentHistory
//         });
//       })
//       .catch((err) => {
//         console.error("Error inserting installments:", err);
//         res.status(500).send("Error inserting installments into the database");
//       });
//   });
// });

// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object

//   // Step 1: Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number,
//       scheme_name,
//       property_unique_id,
//       allottee_name,
//       fathers_husbands_name,
//       permanent_address,
//       current_address,
//       mobile_number,
//       property_category,
//       property_number,
//       registration_amount,
//       registration_date,
//       allotment_amount,
//       allotment_date,
//       sale_price,
//       freehold_amount,
//       lease_rent_amount,
//       park_charge,
//       corner_charge,
//       remaining_sale_price_lump_sum,
//       remaining_sale_price_installments,
//       interest_amount,
//       area_square_meter,
//       possession_date,
//       additional_land_amount,
//       restoration_charges,
//       certificate_charges,
//       service_charges_financial_year,
//       service_charges_amount,
//       service_charges_late_fee,
//       service_charges_date,
//       registration_charges,
//       registration_date_2,
//       transfer_name,
//       transferors_fathers_husbands_name,
//       address,
//       inheritance,
//       transfer_fee,
//       documentation_fee,
//       transfer_date,
//       building_plan_approval_date,
//       building_construction,
//       deposit_date,
//       receipt_number,
//       change_fee,
//       advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"],
//     formData["schemeName"],
//     formData["propertyId"],
//     formData["ownerName"],
//     formData["fatherName"],
//     formData["permanentAddress"],
//     formData["currentAddress"],
//     formData["mobileNumber"],
//     formData["category"],
//     formData["propertyNumber"],
//     formData["registrationAmount"],
//     formData["registrationDate"],
//     formData["allotmentAmount"],
//     formData["allotmentDate"],
//     formData["salePrice"],
//     formData["freeholdAmount"],
//     formData["leaseRent"],
//     formData["parkCharge"],
//     formData["cornerCharge"],
//     formData["remainingSalePrice"],
//     formData["remainingInstallment"],
//     formData["interestAmount"],
//     formData["area_square_meter"],
//     formData["possession_date"],
//     formData["additional_land_amount"],
//     formData["restoration_charges"],
//     formData["certificate_charges"],
//     formData["service_charges_financial_year"],
//     formData["service_charges_amount"],
//     formData["service_charges_late_fee"],
//     formData["service_charges_date"],
//     formData["registration_charges"],
//     formData["registration_date_2"],
//     formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"],
//     formData["address"],
//     formData["inheritance"],
//     formData["transfer_fee"],
//     formData["documentation_fee"],
//     formData["transfer_date"],
//     formData["building_plan_approval_date"],
//     formData["building_construction"],
//     formData["deposit_date"],
//     formData["receipt_number"],
//     formData["change_fee"],
//     formData["advertisement_fee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).send("Error inserting property data into the database");
//     }

//     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

//     // Step 2: Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id,
//         installment_payment_amount,
//         installment_interest_amount,
//         delayed_interest_amount,
//         installment_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     const installmentValues = [
//       propertyId,
//       formData["installmentAmount"],
//       formData["installmentInterest"],
//       formData["delayed_interest_amount"],
//       formData["installmentDate"] // Ensure this field exists in your formData
//     ];

//     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
//       if (err) {
//         console.error("Error inserting installment data:", err);
//         return res.status(500).send("Error inserting installment data into the database");
//       }

//       // Step 3: Insert data into the service_charge table
//       const serviceChargeQuery = `
//         INSERT INTO service_charge (
//           property_id,
//           service_charge_financial_year,
//           service_charge_amount,
//           service_charges_late_fee,
//           service_charges_date
//         ) VALUES (?, ?, ?, ?, ?)`;

//       const serviceChargeValues = [
//         propertyId,
//         formData["serviceChargeFinancialYear"],
//         formData["serviceChargeAmount"],
//         formData["serviceChargesLateFee"],
//         formData["serviceChargesDate"] // Ensure this field exists in your formData
//       ];

//       pool.query(serviceChargeQuery, serviceChargeValues, (err, serviceChargeResult) => {
//         if (err) {
//           console.error("Error inserting service charge data:", err);
//           return res.status(500).send("Error inserting service charge data into the database");
//         }

//         res.status(200).json({
//           message: "Data inserted successfully",
//           propertyData: formData,
//           installmentData: {
//             installmentAmount: formData["installmentAmount"],
//             installmentInterest: formData["installmentInterest"],
//             delayedInterest: formData["delayed_interest_amount"],
//             installmentDate: formData["installmentDate"]
//           },
//           serviceChargeData: {
//             serviceChargeFinancialYear: formData["serviceChargeFinancialYear"],
//             serviceChargeAmount: formData["serviceChargeAmount"],
//             serviceChargesLateFee: formData["serviceChargesLateFee"],
//             serviceChargesDate: formData["serviceChargesDate"]
//           }
//         });
//       });
//     });
//   });
// });




// const createInstallmentsTable = `
//   CREATE TABLE IF NOT EXISTS installments (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     property_id INT NOT NULL, -- Foreign key to link with property table
//     installment_payment_amount DECIMAL(10,2),
//     installment_interest_amount DECIMAL(10,2),
//     delayed_interest_amount DECIMAL(10,2),
//     installment_date DATE,
//     FOREIGN KEY (property_id) REFERENCES property(id) ON DELETE CASCADE
//   );
// `;

// // Execute this query once when setting up the database
// pool.query(createInstallmentsTable, (err) => {
//   if (err) {
//     console.error("Error creating installments table:", err);
//   } else {
//     console.log("Installments table created successfully.");
//   }
// });


// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object

//   // Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number,
//       scheme_name,
//       property_unique_id,
//       allottee_name,
//       fathers_husbands_name,
//       permanent_address,
//       current_address,
//       mobile_number,
//       property_category,
//       property_number,
//       registration_amount,
//       registration_date,
//       allotment_amount,
//       allotment_date,
//       sale_price,
//       freehold_amount,
//       lease_rent_amount,
//       park_charge,
//       corner_charge,
//       remaining_sale_price_lump_sum,
//       remaining_sale_price_installments,
//       interest_amount,
//       area_square_meter,
//       possession_date,
//       additional_land_amount,
//       restoration_charges,
//       certificate_charges,
//       service_charges_financial_year,
//       service_charges_amount,
//       service_charges_late_fee,
//       service_charges_date,
//       registration_charges,
//       registration_date_2,
//       transfer_name,
//       transferors_fathers_husbands_name,
//       address,
//       inheritance,
//       transfer_fee,
//       documentation_fee,
//       transfer_date,
//       building_plan_approval_date,
//       building_construction,
//       deposit_date,
//       receipt_number,
//       change_fee,
//       advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"],
//     formData["schemeName"],
//     formData["propertyId"],
//     formData["ownerName"],
//     formData["fatherName"],
//     formData["permanentAddress"],
//     formData["currentAddress"],
//     formData["mobileNumber"],
//     formData["category"],
//     formData["propertyNumber"],
//     formData["registrationAmount"],
//     formData["registrationDate"],
//     formData["allotmentAmount"],
//     formData["allotmentDate"],
//     formData["salePrice"],
//     formData["freeholdAmount"],
//     formData["leaseRent"],
//     formData["parkCharge"],
//     formData["cornerCharge"],
//     formData["remainingSalePrice"],
//     formData["remainingInstallment"],
//     formData["interestAmount"],
//     formData["area_square_meter"],
//     formData["possession_date"],
//     formData["additional_land_amount"],
//     formData["restoration_charges"],
//     formData["certificate_charges"],
//     formData["service_charges_financial_year"],
//     formData["service_charges_amount"],
//     formData["service_charges_late_fee"],
//     formData["service_charges_date"],
//     formData["registration_charges"],
//     formData["registration_date_2"],
//     formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"],
//     formData["address"],
//     formData["inheritance"],
//     formData["transfer_fee"],
//     formData["documentation_fee"],
//     formData["transfer_date"],
//     formData["building_plan_approval_date"],
//     formData["building_construction"],
//     formData["deposit_date"],
//     formData["receipt_number"],
//     formData["change_fee"],
//     formData["advertisement_fee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).send("Error inserting property data into the database");
//     }

//     const propertyId = propertyResult.insertId; // Get the ID of the inserted property
//     console.log(propertyId);
    
//     // Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id,
//         installment_payment_amount,
//         installment_interest_amount,
//         delayed_interest_amount,
//         installment_date
//       ) VALUES (?, ?, ?, ?, ?)
//     `;

//     const installmentValues = [
//       propertyId,
//       formData["installmentAmount"],
//       formData["installmentInterest"],
//       formData["delayed_interest_amount"],
//       formData["installmentDate"] // Ensure this field exists in your formData
//     ];

//     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
//       if (err) {
//         console.error("Error inserting installment data:", err);
//         return res.status(500).send("Error inserting installment data into the database");
//       }

//       res.status(200).json({
//         message: "Data inserted successfully",
//         propertyData: formData,
//         installmentData: {
//           installmentAmount: formData["installmentAmount"],
//           installmentInterest: formData["installmentInterest"],
//           delayedInterest: formData["delayed_interest_amount"],
//           installmentDate: formData["installmentDate"]
//         }
//       });
//     });
//   });
// });




// old post request
// // POST route to insert form data into the database
// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object
//   console.log(formData);  // Log form data to verify


//   // Construct SQL query to insert form data
// //   make sure query and values are same.
//   const query = `
//     INSERT INTO property (
//       serial_number,
//        scheme_name,
//         property_unique_id,
//          allottee_name,
//           fathers_husbands_name,
//            permanent_address,
//       current_address,
//        mobile_number,
//         property_category,
//          property_number,
//           registration_amount,
//            registration_date,
//       allotment_amount,
//        allotment_date,
//         sale_price,
//          freehold_amount,
//           lease_rent_amount,
//            park_charge,
//             corner_charge,
//       remaining_sale_price_lump_sum,
//        remaining_sale_price_installments,
//         interest_amount,
//          installment_payment_amount,
//       installment_interest_amount,
//        delayed_interest_amount,
//         area_square_meter,
//          possession_date,
//           additional_land_amount,
//       restoration_charges,
//        certificate_charges,
//         service_charges_financial_year,
//          service_charges_amount,
//           service_charges_late_fee,
//       service_charges_date,
//        registration_charges,
//         registration_date_2,
//          transfer_name,
//           transferors_fathers_husbands_name,
//            address,
//       inheritance,
//        transfer_fee,
//         documentation_fee,
//          transfer_date,
//           building_plan_approval_date,
//            building_construction,
//       deposit_date,
//        receipt_number,
//         change_fee,
//          advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const values = [
//     formData["serialNumber"],
//      formData["schemeName"], 
//      formData["propertyId"],
//       formData["ownerName"], 
//     formData["fatherName"],
//      formData["permanentAddress"],
//       formData["currentAddress"],
//        formData["mobileNumber"],
//     formData["category"],
//      formData["propertyNumber"],
//       formData["registrationAmount"],
//        formData["registrationDate"],
//     formData["allotmentAmount"],
//      formData["allotmentDate"],
//       formData["salePrice"],
//        formData["freeholdAmount"], 
//        formData["leaseRent"],
//     formData["parkCharge"],
//      formData["cornerCharge"],
//       formData["remainingSalePrice"],
//        formData["remainingInstallment"],
//     formData["interestAmount"],
//      formData["installmentAmount"],
//       formData["installmentInterest"],
//        formData["delayed_interest_amount"],
//     formData["area_square_meter"],
//      formData["possession_date"],
//       formData["additional_land_amount"],
//        formData["restoration_charges"],
//     formData["certificate_charges"],
//      formData["service_charges_financial_year"],
//       formData["service_charges_amount"],
//        formData["service_charges_late_fee"],
//     formData["service_charges_date"],
//      formData["registration_charges"],
//       formData["registration_date_2"],
//        formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"],
//      formData["address"],
//       formData["inheritance"],
//        formData["transfer_fee"],
//         formData["documentation_fee"],
//     formData["transfer_date"],
//      formData["building_plan_approval_date"],
//       formData["building_construction"],
//        formData["deposit_date"],
//     formData["receipt_number"],
//      formData["change_fee"],
//       formData["advertisement_fee"]
//   ];


  

//   // Execute the SQL query
//   pool.query(query, values, (err, result) => {
//     if (err) {
//       console.error('Error inserting data:', err);
//       return res.status(500).send('Error inserting data into the database');
//     }
//     res.status(200).json({message:'Data inserted successfully' , data: formData});
//   });
// });

// GET route to fetch all data from the property table--


// post request is working all good and data is coming from frontend but get req has been written to send all data except installments and service_charge array
// const express = require('express');
// const router = express.Router();
// const pool = require('../utils/pool');
// const generatePropertyUniqueId =  require('../middleware/schemeName')

// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // Form data from the frontend
//   const paymentHistory = formData.paymentHistory; // Array of payment history
//   const serviceChargeHistory = formData.serviceChargeHistory; // Array of service charges


//   // Step 1: Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number, scheme_name, property_unique_id, allottee_name, fathers_husbands_name,
//       permanent_address, current_address, mobile_number, property_category, property_number,
//       registration_amount, registration_date, allotment_amount, allotment_date, sale_price,
//       freehold_amount, lease_rent_amount, park_charge, corner_charge,
//       remaining_sale_price_lump_sum, remaining_sale_price_installments, interest_amount, remaining_installment_date,
//       area_square_meter, possession_date, additional_land_amount, restoration_charges,
//       certificate_charges, registration_charges, registration_date_2,
//       transfer_name, transferors_fathers_husbands_name, address, inheritance,
//       transfer_fee, documentation_fee, transfer_date, building_plan_approval_date,
//       building_construction, deposit_date, change_fee, advertisement_fee
//     ) VALUES (?,? ,?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"], formData["schemeName"], formData["propertyId"], formData["allotteName"],
//     formData["fatherHusbandName"], formData["permanentAddress"], formData["currentAddress"],
//     formData["mobileNumber"], formData["propertyCategory"], formData["propertyNumber"],
//     formData["registrationAmount"], formData["registrationDate"], formData["allotmentAmount"],
//     formData["allotmentDate"], formData["salePrice"], formData["freeholdAmount"],
//     formData["leaseRentAmount"], formData["parkCharge"], formData["cornerCharge"],
//     formData["remainingSalePriceLumpSum"], formData["remainingSalePriceInstallment"], formData["interestAmount"], 
//     formData["remainingInstallmentDate"],
//     formData["areaSquareMeter"], formData["possessionDate"], formData["additionalLandAmount"],
//     formData["restorationCharges"], formData["certificateCharges"], 
//     formData["registrationCharges"], formData["registrationDate2"], formData["transferName"],
//     formData["transferorFatherHusbandName"], formData["transferorAddress"], formData["inheritance"],
//     formData["transferCharges"], formData["documentationCharges"], formData["transferDate"],
//     formData["buildingPlanApprovalDate"], formData["buildingConstruction"], formData["depositDateReceiptNumber"],
//      formData["changeFee"], formData["advertisementFee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).json({ message: "Error inserting property data into the database" , errorObj: err});
//     }

//     const propertyId = propertyResult.insertId; // ID of the inserted property

//     // Step 2: Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id, installment_payment_amount, installment_interest_amount, delayed_interest_amount, installment_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     const installmentPromises = paymentHistory.map((installment) => {
//       const installmentValues = [
//         propertyId,
//         installment.installmentAmount,
//         installment.installmentInterest,
//         installment.delayedInterestAmount,
//         installment.installmentDate
//       ];

//       return new Promise((resolve, reject) => {
//         pool.query(installmentQuery, installmentValues, (err, result) => {
//           if (err) {
//             console.error("Error inserting installment data:", err);
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//     });

//     // Step 3: Insert data into the service charges table
//     const serviceChargeQuery = `
//       INSERT INTO service_charge (
//         property_id, service_charge_financial_year, service_charge_amount, service_charges_late_fee, service_charges_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     const serviceChargePromises = serviceChargeHistory.map((serviceCharge) => {
//       const serviceChargeValues = [
//         propertyId,
//         serviceCharge.financialYear,
//         serviceCharge.amount,
//         serviceCharge.lateFee,
//         serviceCharge.date
//       ];

//       return new Promise((resolve, reject) => {
//         pool.query(serviceChargeQuery, serviceChargeValues, (err, result) => {
//           if (err) {
//             console.error("Error inserting service charge data:", err);
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//     });

//     // Step 4: Combine all promises and send response
//     Promise.all([...installmentPromises, ...serviceChargePromises])
//       .then(() => {
//         res.status(200).json({
//           message: "Data inserted successfully",
//           propertyData: formData,
//           paymentHistory,
//           serviceChargeHistory
//         });
//       })
//       .catch((err) => {
//         console.error("Error inserting data:", err);
//         res.status(500).json({ message: "Error inserting property data into the database" , errorObj: err});
//       });
//   });
// });

// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object
//   const paymentHistory = formData.paymentHistory; // Ensure this is an array of objects from the frontend

//   // Step 1: Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number, scheme_name, property_unique_id, allottee_name, fathers_husbands_name,
//       permanent_address, current_address, mobile_number, property_category, property_number,
//       registration_amount, registration_date, allotment_amount, allotment_date, sale_price,
//       freehold_amount, lease_rent_amount, park_charge, corner_charge,
//       remaining_sale_price_lump_sum, remaining_sale_price_installments, interest_amount,
//       area_square_meter, possession_date, additional_land_amount, restoration_charges,
//       certificate_charges, service_charges_financial_year, service_charges_amount,
//       service_charges_late_fee, service_charges_date, registration_charges, registration_date_2,
//       transfer_name, transferors_fathers_husbands_name, address, inheritance,
//       transfer_fee, documentation_fee, transfer_date, building_plan_approval_date,
//       building_construction, deposit_date, receipt_number, change_fee, advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"], formData["schemeName"], formData["propertyId"], formData["ownerName"],
//     formData["fatherName"], formData["permanentAddress"], formData["currentAddress"],
//     formData["mobileNumber"], formData["category"], formData["propertyNumber"],
//     formData["registrationAmount"], formData["registrationDate"], formData["allotmentAmount"],
//     formData["allotmentDate"], formData["salePrice"], formData["freeholdAmount"],
//     formData["leaseRent"], formData["parkCharge"], formData["cornerCharge"],
//     formData["remainingSalePrice"], formData["remainingInstallment"], formData["interestAmount"],
//     formData["area_square_meter"], formData["possession_date"], formData["additional_land_amount"],
//     formData["restoration_charges"], formData["certificate_charges"], formData["service_charges_financial_year"],
//     formData["service_charges_amount"], formData["service_charges_late_fee"], formData["service_charges_date"],
//     formData["registration_charges"], formData["registration_date_2"], formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"], formData["address"], formData["inheritance"],
//     formData["transfer_fee"], formData["documentation_fee"], formData["transfer_date"],
//     formData["building_plan_approval_date"], formData["building_construction"], formData["deposit_date"],
//     formData["receipt_number"], formData["change_fee"], formData["advertisement_fee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).send("Error inserting property data into the database");
//     }

//     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

//     // Step 2: Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id, installment_payment_amount, installment_interest_amount, delayed_interest_amount, installment_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     // Use a loop to iterate over the paymentHistory array
//     const installmentPromises = paymentHistory.map((installment) => {
//       const installmentValues = [
//         propertyId,
//         installment.installmentAmount,
//         installment.installmentInterest,
//         installment.delayedInterestAmount,
//         installment.installmentDate
//       ];

//       return new Promise((resolve, reject) => {
//         pool.query(installmentQuery, installmentValues, (err, result) => {
//           if (err) {
//             console.error("Error inserting installment data:", err);
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//     });

//     Promise.all(installmentPromises)
//       .then(() => {
//         res.status(200).json({
//           message: "Data inserted successfully",
//           propertyData: formData,
//           paymentHistory
//         });
//       })
//       .catch((err) => {
//         console.error("Error inserting installments:", err);
//         res.status(500).send("Error inserting installments into the database");
//       });
//   });
// });

// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object

//   // Step 1: Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number,
//       scheme_name,
//       property_unique_id,
//       allottee_name,
//       fathers_husbands_name,
//       permanent_address,
//       current_address,
//       mobile_number,
//       property_category,
//       property_number,
//       registration_amount,
//       registration_date,
//       allotment_amount,
//       allotment_date,
//       sale_price,
//       freehold_amount,
//       lease_rent_amount,
//       park_charge,
//       corner_charge,
//       remaining_sale_price_lump_sum,
//       remaining_sale_price_installments,
//       interest_amount,
//       area_square_meter,
//       possession_date,
//       additional_land_amount,
//       restoration_charges,
//       certificate_charges,
//       service_charges_financial_year,
//       service_charges_amount,
//       service_charges_late_fee,
//       service_charges_date,
//       registration_charges,
//       registration_date_2,
//       transfer_name,
//       transferors_fathers_husbands_name,
//       address,
//       inheritance,
//       transfer_fee,
//       documentation_fee,
//       transfer_date,
//       building_plan_approval_date,
//       building_construction,
//       deposit_date,
//       receipt_number,
//       change_fee,
//       advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"],
//     formData["schemeName"],
//     formData["propertyId"],
//     formData["ownerName"],
//     formData["fatherName"],
//     formData["permanentAddress"],
//     formData["currentAddress"],
//     formData["mobileNumber"],
//     formData["category"],
//     formData["propertyNumber"],
//     formData["registrationAmount"],
//     formData["registrationDate"],
//     formData["allotmentAmount"],
//     formData["allotmentDate"],
//     formData["salePrice"],
//     formData["freeholdAmount"],
//     formData["leaseRent"],
//     formData["parkCharge"],
//     formData["cornerCharge"],
//     formData["remainingSalePrice"],
//     formData["remainingInstallment"],
//     formData["interestAmount"],
//     formData["area_square_meter"],
//     formData["possession_date"],
//     formData["additional_land_amount"],
//     formData["restoration_charges"],
//     formData["certificate_charges"],
//     formData["service_charges_financial_year"],
//     formData["service_charges_amount"],
//     formData["service_charges_late_fee"],
//     formData["service_charges_date"],
//     formData["registration_charges"],
//     formData["registration_date_2"],
//     formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"],
//     formData["address"],
//     formData["inheritance"],
//     formData["transfer_fee"],
//     formData["documentation_fee"],
//     formData["transfer_date"],
//     formData["building_plan_approval_date"],
//     formData["building_construction"],
//     formData["deposit_date"],
//     formData["receipt_number"],
//     formData["change_fee"],
//     formData["advertisement_fee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).send("Error inserting property data into the database");
//     }

//     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

//     // Step 2: Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id,
//         installment_payment_amount,
//         installment_interest_amount,
//         delayed_interest_amount,
//         installment_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     const installmentValues = [
//       propertyId,
//       formData["installmentAmount"],
//       formData["installmentInterest"],
//       formData["delayed_interest_amount"],
//       formData["installmentDate"] // Ensure this field exists in your formData
//     ];

//     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
//       if (err) {
//         console.error("Error inserting installment data:", err);
//         return res.status(500).send("Error inserting installment data into the database");
//       }

//       // Step 3: Insert data into the service_charge table
//       const serviceChargeQuery = `
//         INSERT INTO service_charge (
//           property_id,
//           service_charge_financial_year,
//           service_charge_amount,
//           service_charges_late_fee,
//           service_charges_date
//         ) VALUES (?, ?, ?, ?, ?)`;

//       const serviceChargeValues = [
//         propertyId,
//         formData["serviceChargeFinancialYear"],
//         formData["serviceChargeAmount"],
//         formData["serviceChargesLateFee"],
//         formData["serviceChargesDate"] // Ensure this field exists in your formData
//       ];

//       pool.query(serviceChargeQuery, serviceChargeValues, (err, serviceChargeResult) => {
//         if (err) {
//           console.error("Error inserting service charge data:", err);
//           return res.status(500).send("Error inserting service charge data into the database");
//         }

//         res.status(200).json({
//           message: "Data inserted successfully",
//           propertyData: formData,
//           installmentData: {
//             installmentAmount: formData["installmentAmount"],
//             installmentInterest: formData["installmentInterest"],
//             delayedInterest: formData["delayed_interest_amount"],
//             installmentDate: formData["installmentDate"]
//           },
//           serviceChargeData: {
//             serviceChargeFinancialYear: formData["serviceChargeFinancialYear"],
//             serviceChargeAmount: formData["serviceChargeAmount"],
//             serviceChargesLateFee: formData["serviceChargesLateFee"],
//             serviceChargesDate: formData["serviceChargesDate"]
//           }
//         });
//       });
//     });
//   });
// });




// const createInstallmentsTable = `
//   CREATE TABLE IF NOT EXISTS installments (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     property_id INT NOT NULL, -- Foreign key to link with property table
//     installment_payment_amount DECIMAL(10,2),
//     installment_interest_amount DECIMAL(10,2),
//     delayed_interest_amount DECIMAL(10,2),
//     installment_date DATE,
//     FOREIGN KEY (property_id) REFERENCES property(id) ON DELETE CASCADE
//   );
// `;

// // Execute this query once when setting up the database
// pool.query(createInstallmentsTable, (err) => {
//   if (err) {
//     console.error("Error creating installments table:", err);
//   } else {
//     console.log("Installments table created successfully.");
//   }
// });


// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object

//   // Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number,
//       scheme_name,
//       property_unique_id,
//       allottee_name,
//       fathers_husbands_name,
//       permanent_address,
//       current_address,
//       mobile_number,
//       property_category,
//       property_number,
//       registration_amount,
//       registration_date,
//       allotment_amount,
//       allotment_date,
//       sale_price,
//       freehold_amount,
//       lease_rent_amount,
//       park_charge,
//       corner_charge,
//       remaining_sale_price_lump_sum,
//       remaining_sale_price_installments,
//       interest_amount,
//       area_square_meter,
//       possession_date,
//       additional_land_amount,
//       restoration_charges,
//       certificate_charges,
//       service_charges_financial_year,
//       service_charges_amount,
//       service_charges_late_fee,
//       service_charges_date,
//       registration_charges,
//       registration_date_2,
//       transfer_name,
//       transferors_fathers_husbands_name,
//       address,
//       inheritance,
//       transfer_fee,
//       documentation_fee,
//       transfer_date,
//       building_plan_approval_date,
//       building_construction,
//       deposit_date,
//       receipt_number,
//       change_fee,
//       advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"],
//     formData["schemeName"],
//     formData["propertyId"],
//     formData["ownerName"],
//     formData["fatherName"],
//     formData["permanentAddress"],
//     formData["currentAddress"],
//     formData["mobileNumber"],
//     formData["category"],
//     formData["propertyNumber"],
//     formData["registrationAmount"],
//     formData["registrationDate"],
//     formData["allotmentAmount"],
//     formData["allotmentDate"],
//     formData["salePrice"],
//     formData["freeholdAmount"],
//     formData["leaseRent"],
//     formData["parkCharge"],
//     formData["cornerCharge"],
//     formData["remainingSalePrice"],
//     formData["remainingInstallment"],
//     formData["interestAmount"],
//     formData["area_square_meter"],
//     formData["possession_date"],
//     formData["additional_land_amount"],
//     formData["restoration_charges"],
//     formData["certificate_charges"],
//     formData["service_charges_financial_year"],
//     formData["service_charges_amount"],
//     formData["service_charges_late_fee"],
//     formData["service_charges_date"],
//     formData["registration_charges"],
//     formData["registration_date_2"],
//     formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"],
//     formData["address"],
//     formData["inheritance"],
//     formData["transfer_fee"],
//     formData["documentation_fee"],
//     formData["transfer_date"],
//     formData["building_plan_approval_date"],
//     formData["building_construction"],
//     formData["deposit_date"],
//     formData["receipt_number"],
//     formData["change_fee"],
//     formData["advertisement_fee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).send("Error inserting property data into the database");
//     }

//     const propertyId = propertyResult.insertId; // Get the ID of the inserted property
//     console.log(propertyId);
    
//     // Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id,
//         installment_payment_amount,
//         installment_interest_amount,
//         delayed_interest_amount,
//         installment_date
//       ) VALUES (?, ?, ?, ?, ?)
//     `;

//     const installmentValues = [
//       propertyId,
//       formData["installmentAmount"],
//       formData["installmentInterest"],
//       formData["delayed_interest_amount"],
//       formData["installmentDate"] // Ensure this field exists in your formData
//     ];

//     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
//       if (err) {
//         console.error("Error inserting installment data:", err);
//         return res.status(500).send("Error inserting installment data into the database");
//       }

//       res.status(200).json({
//         message: "Data inserted successfully",
//         propertyData: formData,
//         installmentData: {
//           installmentAmount: formData["installmentAmount"],
//           installmentInterest: formData["installmentInterest"],
//           delayedInterest: formData["delayed_interest_amount"],
//           installmentDate: formData["installmentDate"]
//         }
//       });
//     });
//   });
// });




// old post request
// // POST route to insert form data into the database
// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // This contains the form data as an object
//   console.log(formData);  // Log form data to verify


//   // Construct SQL query to insert form data
// //   make sure query and values are same.
//   const query = `
//     INSERT INTO property (
//       serial_number,
//        scheme_name,
//         property_unique_id,
//          allottee_name,
//           fathers_husbands_name,
//            permanent_address,
//       current_address,
//        mobile_number,
//         property_category,
//          property_number,
//           registration_amount,
//            registration_date,
//       allotment_amount,
//        allotment_date,
//         sale_price,
//          freehold_amount,
//           lease_rent_amount,
//            park_charge,
//             corner_charge,
//       remaining_sale_price_lump_sum,
//        remaining_sale_price_installments,
//         interest_amount,
//          installment_payment_amount,
//       installment_interest_amount,
//        delayed_interest_amount,
//         area_square_meter,
//          possession_date,
//           additional_land_amount,
//       restoration_charges,
//        certificate_charges,
//         service_charges_financial_year,
//          service_charges_amount,
//           service_charges_late_fee,
//       service_charges_date,
//        registration_charges,
//         registration_date_2,
//          transfer_name,
//           transferors_fathers_husbands_name,
//            address,
//       inheritance,
//        transfer_fee,
//         documentation_fee,
//          transfer_date,
//           building_plan_approval_date,
//            building_construction,
//       deposit_date,
//        receipt_number,
//         change_fee,
//          advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const values = [
//     formData["serialNumber"],
//      formData["schemeName"], 
//      formData["propertyId"],
//       formData["ownerName"], 
//     formData["fatherName"],
//      formData["permanentAddress"],
//       formData["currentAddress"],
//        formData["mobileNumber"],
//     formData["category"],
//      formData["propertyNumber"],
//       formData["registrationAmount"],
//        formData["registrationDate"],
//     formData["allotmentAmount"],
//      formData["allotmentDate"],
//       formData["salePrice"],
//        formData["freeholdAmount"], 
//        formData["leaseRent"],
//     formData["parkCharge"],
//      formData["cornerCharge"],
//       formData["remainingSalePrice"],
//        formData["remainingInstallment"],
//     formData["interestAmount"],
//      formData["installmentAmount"],
//       formData["installmentInterest"],
//        formData["delayed_interest_amount"],
//     formData["area_square_meter"],
//      formData["possession_date"],
//       formData["additional_land_amount"],
//        formData["restoration_charges"],
//     formData["certificate_charges"],
//      formData["service_charges_financial_year"],
//       formData["service_charges_amount"],
//        formData["service_charges_late_fee"],
//     formData["service_charges_date"],
//      formData["registration_charges"],
//       formData["registration_date_2"],
//        formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"],
//      formData["address"],
//       formData["inheritance"],
//        formData["transfer_fee"],
//         formData["documentation_fee"],
//     formData["transfer_date"],
//      formData["building_plan_approval_date"],
//       formData["building_construction"],
//        formData["deposit_date"],
//     formData["receipt_number"],
//      formData["change_fee"],
//       formData["advertisement_fee"]
//   ];


  

//   // Execute the SQL query
//   pool.query(query, values, (err, result) => {
//     if (err) {
//       console.error('Error inserting data:', err);
//       return res.status(500).send('Error inserting data into the database');
//     }
//     res.status(200).json({message:'Data inserted successfully' , data: formData});
//   });
// });

// GET route to fetch all data from the property table--




router.get('/', (req, res) => {
    const query = 'SELECT * FROM property';
  
    pool.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching data:', err);
        return res.status(500).send('Error fetching data from the database');
      }
  
      res.status(200).json({
        message: 'Data fetched successfully',
        data: results,
      });
    });
  });

module.exports = router;


//installment and service working
// const express = require('express');
// const router = express.Router();
// const pool = require('../utils/pool');
// const generatePropertyUniqueId =  require('../middleware/schemeName')

// router.post('/', generatePropertyUniqueId, (req, res) => {
//   const formData = req.body; // Form data from the frontend
//   const paymentHistory = formData.paymentHistory; // Array of payment history
//   const serviceChargeHistory = formData.serviceChargeHistory; // Array of service charges

//   // Step 1: Insert data into the property table
//   const propertyQuery = `
//     INSERT INTO property (
//       serial_number, scheme_name, property_unique_id, allottee_name, fathers_husbands_name,
//       permanent_address, current_address, mobile_number, property_category, property_number,
//       registration_amount, registration_date, allotment_amount, allotment_date, sale_price,
//       freehold_amount, lease_rent_amount, park_charge, corner_charge,
//       remaining_sale_price_lump_sum, remaining_sale_price_installments, interest_amount,
//       area_square_meter, possession_date, additional_land_amount, restoration_charges,
//       certificate_charges, service_charges_financial_year, service_charges_amount,
//       service_charges_late_fee, service_charges_date, registration_charges, registration_date_2,
//       transfer_name, transferors_fathers_husbands_name, address, inheritance,
//       transfer_fee, documentation_fee, transfer_date, building_plan_approval_date,
//       building_construction, deposit_date, receipt_number, change_fee, advertisement_fee
//     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//   const propertyValues = [
//     formData["serialNumber"], formData["schemeName"], formData["propertyId"], formData["ownerName"],
//     formData["fatherName"], formData["permanentAddress"], formData["currentAddress"],
//     formData["mobileNumber"], formData["category"], formData["propertyNumber"],
//     formData["registrationAmount"], formData["registrationDate"], formData["allotmentAmount"],
//     formData["allotmentDate"], formData["salePrice"], formData["freeholdAmount"],
//     formData["leaseRent"], formData["parkCharge"], formData["cornerCharge"],
//     formData["remainingSalePrice"], formData["remainingInstallment"], formData["interestAmount"],
//     formData["area_square_meter"], formData["possession_date"], formData["additional_land_amount"],
//     formData["restoration_charges"], formData["certificate_charges"], formData["service_charges_financial_year"],
//     formData["service_charges_amount"], formData["service_charges_late_fee"], formData["service_charges_date"],
//     formData["registration_charges"], formData["registration_date_2"], formData["transfer_name"],
//     formData["transferors_fathers_husbands_name"], formData["address"], formData["inheritance"],
//     formData["transfer_fee"], formData["documentation_fee"], formData["transfer_date"],
//     formData["building_plan_approval_date"], formData["building_construction"], formData["deposit_date"],
//     formData["receipt_number"], formData["change_fee"], formData["advertisement_fee"]
//   ];

//   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
//     if (err) {
//       console.error("Error inserting property data:", err);
//       return res.status(500).send("Error inserting property data into the database");
//     }

//     const propertyId = propertyResult.insertId; // ID of the inserted property

//     // Step 2: Insert data into the installments table
//     const installmentQuery = `
//       INSERT INTO installments (
//         property_id, installment_payment_amount, installment_interest_amount, delayed_interest_amount, installment_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     const installmentPromises = paymentHistory.map((installment) => {
//       const installmentValues = [
//         propertyId,
//         installment.installmentAmount,
//         installment.installmentInterest,
//         installment.delayedInterestAmount,
//         installment.installmentDate
//       ];

//       return new Promise((resolve, reject) => {
//         pool.query(installmentQuery, installmentValues, (err, result) => {
//           if (err) {
//             console.error("Error inserting installment data:", err);
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//     });

//     // Step 3: Insert data into the service charges table
//     const serviceChargeQuery = `
//       INSERT INTO service_charge (
//         property_id, service_charge_financial_year, service_charge_amount, service_charges_late_fee, service_charges_date
//       ) VALUES (?, ?, ?, ?, ?)`;

//     const serviceChargePromises = serviceChargeHistory.map((serviceCharge) => {
//       const serviceChargeValues = [
//         propertyId,
//         serviceCharge.financialYear,
//         serviceCharge.amount,
//         serviceCharge.lateFee,
//         serviceCharge.date
//       ];

//       return new Promise((resolve, reject) => {
//         pool.query(serviceChargeQuery, serviceChargeValues, (err, result) => {
//           if (err) {
//             console.error("Error inserting service charge data:", err);
//             reject(err);
//           } else {
//             resolve(result);
//           }
//         });
//       });
//     });

//     // Step 4: Combine all promises and send response
//     Promise.all([...installmentPromises, ...serviceChargePromises])
//       .then(() => {
//         res.status(200).json({
//           message: "Data inserted successfully",
//           propertyData: formData,
//           paymentHistory,
//           serviceChargeHistory
//         });
//       })
//       .catch((err) => {
//         console.error("Error inserting data:", err);
//         res.status(500).send("Error inserting data into the database");
//       });
//   });
// });


// // router.post('/', generatePropertyUniqueId, (req, res) => {
// //   const formData = req.body; // This contains the form data as an object
// //   const paymentHistory = formData.paymentHistory; // Ensure this is an array of objects from the frontend

// //   // Step 1: Insert data into the property table
// //   const propertyQuery = `
// //     INSERT INTO property (
// //       serial_number, scheme_name, property_unique_id, allottee_name, fathers_husbands_name,
// //       permanent_address, current_address, mobile_number, property_category, property_number,
// //       registration_amount, registration_date, allotment_amount, allotment_date, sale_price,
// //       freehold_amount, lease_rent_amount, park_charge, corner_charge,
// //       remaining_sale_price_lump_sum, remaining_sale_price_installments, interest_amount,
// //       area_square_meter, possession_date, additional_land_amount, restoration_charges,
// //       certificate_charges, service_charges_financial_year, service_charges_amount,
// //       service_charges_late_fee, service_charges_date, registration_charges, registration_date_2,
// //       transfer_name, transferors_fathers_husbands_name, address, inheritance,
// //       transfer_fee, documentation_fee, transfer_date, building_plan_approval_date,
// //       building_construction, deposit_date, receipt_number, change_fee, advertisement_fee
// //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// //   const propertyValues = [
// //     formData["serialNumber"], formData["schemeName"], formData["propertyId"], formData["ownerName"],
// //     formData["fatherName"], formData["permanentAddress"], formData["currentAddress"],
// //     formData["mobileNumber"], formData["category"], formData["propertyNumber"],
// //     formData["registrationAmount"], formData["registrationDate"], formData["allotmentAmount"],
// //     formData["allotmentDate"], formData["salePrice"], formData["freeholdAmount"],
// //     formData["leaseRent"], formData["parkCharge"], formData["cornerCharge"],
// //     formData["remainingSalePrice"], formData["remainingInstallment"], formData["interestAmount"],
// //     formData["area_square_meter"], formData["possession_date"], formData["additional_land_amount"],
// //     formData["restoration_charges"], formData["certificate_charges"], formData["service_charges_financial_year"],
// //     formData["service_charges_amount"], formData["service_charges_late_fee"], formData["service_charges_date"],
// //     formData["registration_charges"], formData["registration_date_2"], formData["transfer_name"],
// //     formData["transferors_fathers_husbands_name"], formData["address"], formData["inheritance"],
// //     formData["transfer_fee"], formData["documentation_fee"], formData["transfer_date"],
// //     formData["building_plan_approval_date"], formData["building_construction"], formData["deposit_date"],
// //     formData["receipt_number"], formData["change_fee"], formData["advertisement_fee"]
// //   ];

// //   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
// //     if (err) {
// //       console.error("Error inserting property data:", err);
// //       return res.status(500).send("Error inserting property data into the database");
// //     }

// //     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

// //     // Step 2: Insert data into the installments table
// //     const installmentQuery = `
// //       INSERT INTO installments (
// //         property_id, installment_payment_amount, installment_interest_amount, delayed_interest_amount, installment_date
// //       ) VALUES (?, ?, ?, ?, ?)`;

// //     // Use a loop to iterate over the paymentHistory array
// //     const installmentPromises = paymentHistory.map((installment) => {
// //       const installmentValues = [
// //         propertyId,
// //         installment.installmentAmount,
// //         installment.installmentInterest,
// //         installment.delayedInterestAmount,
// //         installment.installmentDate
// //       ];

// //       return new Promise((resolve, reject) => {
// //         pool.query(installmentQuery, installmentValues, (err, result) => {
// //           if (err) {
// //             console.error("Error inserting installment data:", err);
// //             reject(err);
// //           } else {
// //             resolve(result);
// //           }
// //         });
// //       });
// //     });

// //     Promise.all(installmentPromises)
// //       .then(() => {
// //         res.status(200).json({
// //           message: "Data inserted successfully",
// //           propertyData: formData,
// //           paymentHistory
// //         });
// //       })
// //       .catch((err) => {
// //         console.error("Error inserting installments:", err);
// //         res.status(500).send("Error inserting installments into the database");
// //       });
// //   });
// // });

// // router.post('/', generatePropertyUniqueId, (req, res) => {
// //   const formData = req.body; // This contains the form data as an object

// //   // Step 1: Insert data into the property table
// //   const propertyQuery = `
// //     INSERT INTO property (
// //       serial_number,
// //       scheme_name,
// //       property_unique_id,
// //       allottee_name,
// //       fathers_husbands_name,
// //       permanent_address,
// //       current_address,
// //       mobile_number,
// //       property_category,
// //       property_number,
// //       registration_amount,
// //       registration_date,
// //       allotment_amount,
// //       allotment_date,
// //       sale_price,
// //       freehold_amount,
// //       lease_rent_amount,
// //       park_charge,
// //       corner_charge,
// //       remaining_sale_price_lump_sum,
// //       remaining_sale_price_installments,
// //       interest_amount,
// //       area_square_meter,
// //       possession_date,
// //       additional_land_amount,
// //       restoration_charges,
// //       certificate_charges,
// //       service_charges_financial_year,
// //       service_charges_amount,
// //       service_charges_late_fee,
// //       service_charges_date,
// //       registration_charges,
// //       registration_date_2,
// //       transfer_name,
// //       transferors_fathers_husbands_name,
// //       address,
// //       inheritance,
// //       transfer_fee,
// //       documentation_fee,
// //       transfer_date,
// //       building_plan_approval_date,
// //       building_construction,
// //       deposit_date,
// //       receipt_number,
// //       change_fee,
// //       advertisement_fee
// //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// //   const propertyValues = [
// //     formData["serialNumber"],
// //     formData["schemeName"],
// //     formData["propertyId"],
// //     formData["ownerName"],
// //     formData["fatherName"],
// //     formData["permanentAddress"],
// //     formData["currentAddress"],
// //     formData["mobileNumber"],
// //     formData["category"],
// //     formData["propertyNumber"],
// //     formData["registrationAmount"],
// //     formData["registrationDate"],
// //     formData["allotmentAmount"],
// //     formData["allotmentDate"],
// //     formData["salePrice"],
// //     formData["freeholdAmount"],
// //     formData["leaseRent"],
// //     formData["parkCharge"],
// //     formData["cornerCharge"],
// //     formData["remainingSalePrice"],
// //     formData["remainingInstallment"],
// //     formData["interestAmount"],
// //     formData["area_square_meter"],
// //     formData["possession_date"],
// //     formData["additional_land_amount"],
// //     formData["restoration_charges"],
// //     formData["certificate_charges"],
// //     formData["service_charges_financial_year"],
// //     formData["service_charges_amount"],
// //     formData["service_charges_late_fee"],
// //     formData["service_charges_date"],
// //     formData["registration_charges"],
// //     formData["registration_date_2"],
// //     formData["transfer_name"],
// //     formData["transferors_fathers_husbands_name"],
// //     formData["address"],
// //     formData["inheritance"],
// //     formData["transfer_fee"],
// //     formData["documentation_fee"],
// //     formData["transfer_date"],
// //     formData["building_plan_approval_date"],
// //     formData["building_construction"],
// //     formData["deposit_date"],
// //     formData["receipt_number"],
// //     formData["change_fee"],
// //     formData["advertisement_fee"]
// //   ];

// //   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
// //     if (err) {
// //       console.error("Error inserting property data:", err);
// //       return res.status(500).send("Error inserting property data into the database");
// //     }

// //     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

// //     // Step 2: Insert data into the installments table
// //     const installmentQuery = `
// //       INSERT INTO installments (
// //         property_id,
// //         installment_payment_amount,
// //         installment_interest_amount,
// //         delayed_interest_amount,
// //         installment_date
// //       ) VALUES (?, ?, ?, ?, ?)`;

// //     const installmentValues = [
// //       propertyId,
// //       formData["installmentAmount"],
// //       formData["installmentInterest"],
// //       formData["delayed_interest_amount"],
// //       formData["installmentDate"] // Ensure this field exists in your formData
// //     ];

// //     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
// //       if (err) {
// //         console.error("Error inserting installment data:", err);
// //         return res.status(500).send("Error inserting installment data into the database");
// //       }

// //       // Step 3: Insert data into the service_charge table
// //       const serviceChargeQuery = `
// //         INSERT INTO service_charge (
// //           property_id,
// //           service_charge_financial_year,
// //           service_charge_amount,
// //           service_charges_late_fee,
// //           service_charges_date
// //         ) VALUES (?, ?, ?, ?, ?)`;

// //       const serviceChargeValues = [
// //         propertyId,
// //         formData["serviceChargeFinancialYear"],
// //         formData["serviceChargeAmount"],
// //         formData["serviceChargesLateFee"],
// //         formData["serviceChargesDate"] // Ensure this field exists in your formData
// //       ];

// //       pool.query(serviceChargeQuery, serviceChargeValues, (err, serviceChargeResult) => {
// //         if (err) {
// //           console.error("Error inserting service charge data:", err);
// //           return res.status(500).send("Error inserting service charge data into the database");
// //         }

// //         res.status(200).json({
// //           message: "Data inserted successfully",
// //           propertyData: formData,
// //           installmentData: {
// //             installmentAmount: formData["installmentAmount"],
// //             installmentInterest: formData["installmentInterest"],
// //             delayedInterest: formData["delayed_interest_amount"],
// //             installmentDate: formData["installmentDate"]
// //           },
// //           serviceChargeData: {
// //             serviceChargeFinancialYear: formData["serviceChargeFinancialYear"],
// //             serviceChargeAmount: formData["serviceChargeAmount"],
// //             serviceChargesLateFee: formData["serviceChargesLateFee"],
// //             serviceChargesDate: formData["serviceChargesDate"]
// //           }
// //         });
// //       });
// //     });
// //   });
// // });




// // const createInstallmentsTable = `
// //   CREATE TABLE IF NOT EXISTS installments (
// //     id INT AUTO_INCREMENT PRIMARY KEY,
// //     property_id INT NOT NULL, -- Foreign key to link with property table
// //     installment_payment_amount DECIMAL(10,2),
// //     installment_interest_amount DECIMAL(10,2),
// //     delayed_interest_amount DECIMAL(10,2),
// //     installment_date DATE,
// //     FOREIGN KEY (property_id) REFERENCES property(id) ON DELETE CASCADE
// //   );
// // `;

// // // Execute this query once when setting up the database
// // pool.query(createInstallmentsTable, (err) => {
// //   if (err) {
// //     console.error("Error creating installments table:", err);
// //   } else {
// //     console.log("Installments table created successfully.");
// //   }
// // });


// // router.post('/', generatePropertyUniqueId, (req, res) => {
// //   const formData = req.body; // This contains the form data as an object

// //   // Insert data into the property table
// //   const propertyQuery = `
// //     INSERT INTO property (
// //       serial_number,
// //       scheme_name,
// //       property_unique_id,
// //       allottee_name,
// //       fathers_husbands_name,
// //       permanent_address,
// //       current_address,
// //       mobile_number,
// //       property_category,
// //       property_number,
// //       registration_amount,
// //       registration_date,
// //       allotment_amount,
// //       allotment_date,
// //       sale_price,
// //       freehold_amount,
// //       lease_rent_amount,
// //       park_charge,
// //       corner_charge,
// //       remaining_sale_price_lump_sum,
// //       remaining_sale_price_installments,
// //       interest_amount,
// //       area_square_meter,
// //       possession_date,
// //       additional_land_amount,
// //       restoration_charges,
// //       certificate_charges,
// //       service_charges_financial_year,
// //       service_charges_amount,
// //       service_charges_late_fee,
// //       service_charges_date,
// //       registration_charges,
// //       registration_date_2,
// //       transfer_name,
// //       transferors_fathers_husbands_name,
// //       address,
// //       inheritance,
// //       transfer_fee,
// //       documentation_fee,
// //       transfer_date,
// //       building_plan_approval_date,
// //       building_construction,
// //       deposit_date,
// //       receipt_number,
// //       change_fee,
// //       advertisement_fee
// //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// //   const propertyValues = [
// //     formData["serialNumber"],
// //     formData["schemeName"],
// //     formData["propertyId"],
// //     formData["ownerName"],
// //     formData["fatherName"],
// //     formData["permanentAddress"],
// //     formData["currentAddress"],
// //     formData["mobileNumber"],
// //     formData["category"],
// //     formData["propertyNumber"],
// //     formData["registrationAmount"],
// //     formData["registrationDate"],
// //     formData["allotmentAmount"],
// //     formData["allotmentDate"],
// //     formData["salePrice"],
// //     formData["freeholdAmount"],
// //     formData["leaseRent"],
// //     formData["parkCharge"],
// //     formData["cornerCharge"],
// //     formData["remainingSalePrice"],
// //     formData["remainingInstallment"],
// //     formData["interestAmount"],
// //     formData["area_square_meter"],
// //     formData["possession_date"],
// //     formData["additional_land_amount"],
// //     formData["restoration_charges"],
// //     formData["certificate_charges"],
// //     formData["service_charges_financial_year"],
// //     formData["service_charges_amount"],
// //     formData["service_charges_late_fee"],
// //     formData["service_charges_date"],
// //     formData["registration_charges"],
// //     formData["registration_date_2"],
// //     formData["transfer_name"],
// //     formData["transferors_fathers_husbands_name"],
// //     formData["address"],
// //     formData["inheritance"],
// //     formData["transfer_fee"],
// //     formData["documentation_fee"],
// //     formData["transfer_date"],
// //     formData["building_plan_approval_date"],
// //     formData["building_construction"],
// //     formData["deposit_date"],
// //     formData["receipt_number"],
// //     formData["change_fee"],
// //     formData["advertisement_fee"]
// //   ];

// //   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
// //     if (err) {
// //       console.error("Error inserting property data:", err);
// //       return res.status(500).send("Error inserting property data into the database");
// //     }

// //     const propertyId = propertyResult.insertId; // Get the ID of the inserted property
// //     console.log(propertyId);
    
// //     // Insert data into the installments table
// //     const installmentQuery = `
// //       INSERT INTO installments (
// //         property_id,
// //         installment_payment_amount,
// //         installment_interest_amount,
// //         delayed_interest_amount,
// //         installment_date
// //       ) VALUES (?, ?, ?, ?, ?)
// //     `;

// //     const installmentValues = [
// //       propertyId,
// //       formData["installmentAmount"],
// //       formData["installmentInterest"],
// //       formData["delayed_interest_amount"],
// //       formData["installmentDate"] // Ensure this field exists in your formData
// //     ];

// //     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
// //       if (err) {
// //         console.error("Error inserting installment data:", err);
// //         return res.status(500).send("Error inserting installment data into the database");
// //       }

// //       res.status(200).json({
// //         message: "Data inserted successfully",
// //         propertyData: formData,
// //         installmentData: {
// //           installmentAmount: formData["installmentAmount"],
// //           installmentInterest: formData["installmentInterest"],
// //           delayedInterest: formData["delayed_interest_amount"],
// //           installmentDate: formData["installmentDate"]
// //         }
// //       });
// //     });
// //   });
// // });




// // old post request
// // // POST route to insert form data into the database
// // router.post('/', generatePropertyUniqueId, (req, res) => {
// //   const formData = req.body; // This contains the form data as an object
// //   console.log(formData);  // Log form data to verify


// //   // Construct SQL query to insert form data
// // //   make sure query and values are same.
// //   const query = `
// //     INSERT INTO property (
// //       serial_number,
// //        scheme_name,
// //         property_unique_id,
// //          allottee_name,
// //           fathers_husbands_name,
// //            permanent_address,
// //       current_address,
// //        mobile_number,
// //         property_category,
// //          property_number,
// //           registration_amount,
// //            registration_date,
// //       allotment_amount,
// //        allotment_date,
// //         sale_price,
// //          freehold_amount,
// //           lease_rent_amount,
// //            park_charge,
// //             corner_charge,
// //       remaining_sale_price_lump_sum,
// //        remaining_sale_price_installments,
// //         interest_amount,
// //          installment_payment_amount,
// //       installment_interest_amount,
// //        delayed_interest_amount,
// //         area_square_meter,
// //          possession_date,
// //           additional_land_amount,
// //       restoration_charges,
// //        certificate_charges,
// //         service_charges_financial_year,
// //          service_charges_amount,
// //           service_charges_late_fee,
// //       service_charges_date,
// //        registration_charges,
// //         registration_date_2,
// //          transfer_name,
// //           transferors_fathers_husbands_name,
// //            address,
// //       inheritance,
// //        transfer_fee,
// //         documentation_fee,
// //          transfer_date,
// //           building_plan_approval_date,
// //            building_construction,
// //       deposit_date,
// //        receipt_number,
// //         change_fee,
// //          advertisement_fee
// //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// //   const values = [
// //     formData["serialNumber"],
// //      formData["schemeName"], 
// //      formData["propertyId"],
// //       formData["ownerName"], 
// //     formData["fatherName"],
// //      formData["permanentAddress"],
// //       formData["currentAddress"],
// //        formData["mobileNumber"],
// //     formData["category"],
// //      formData["propertyNumber"],
// //       formData["registrationAmount"],
// //        formData["registrationDate"],
// //     formData["allotmentAmount"],
// //      formData["allotmentDate"],
// //       formData["salePrice"],
// //        formData["freeholdAmount"], 
// //        formData["leaseRent"],
// //     formData["parkCharge"],
// //      formData["cornerCharge"],
// //       formData["remainingSalePrice"],
// //        formData["remainingInstallment"],
// //     formData["interestAmount"],
// //      formData["installmentAmount"],
// //       formData["installmentInterest"],
// //        formData["delayed_interest_amount"],
// //     formData["area_square_meter"],
// //      formData["possession_date"],
// //       formData["additional_land_amount"],
// //        formData["restoration_charges"],
// //     formData["certificate_charges"],
// //      formData["service_charges_financial_year"],
// //       formData["service_charges_amount"],
// //        formData["service_charges_late_fee"],
// //     formData["service_charges_date"],
// //      formData["registration_charges"],
// //       formData["registration_date_2"],
// //        formData["transfer_name"],
// //     formData["transferors_fathers_husbands_name"],
// //      formData["address"],
// //       formData["inheritance"],
// //        formData["transfer_fee"],
// //         formData["documentation_fee"],
// //     formData["transfer_date"],
// //      formData["building_plan_approval_date"],
// //       formData["building_construction"],
// //        formData["deposit_date"],
// //     formData["receipt_number"],
// //      formData["change_fee"],
// //       formData["advertisement_fee"]
// //   ];


  

// //   // Execute the SQL query
// //   pool.query(query, values, (err, result) => {
// //     if (err) {
// //       console.error('Error inserting data:', err);
// //       return res.status(500).send('Error inserting data into the database');
// //     }
// //     res.status(200).json({message:'Data inserted successfully' , data: formData});
// //   });
// // });

// // GET route to fetch all data from the property table--




// router.get('/', (req, res) => {
//     const query = 'SELECT * FROM property';
  
//     pool.query(query, (err, results) => {
//       if (err) {
//         console.error('Error fetching data:', err);
//         return res.status(500).send('Error fetching data from the database');
//       }
  
//       res.status(200).json({
//         message: 'Data fetched successfully',
//         data: results,
//       });
//     });
//   });

// module.exports = router;




// // below all -old code
// // const express = require('express');
// // const router = express.Router();
// // const pool = require('../utils/pool');
// // const generatePropertyUniqueId =  require('../middleware/schemeName')



// // router.post('/', generatePropertyUniqueId, (req, res) => {
// //   const formData = req.body; // This contains the form data as an object
// //   const paymentHistory = formData.paymentHistory; // Ensure this is an array of objects from the frontend

// //   // Step 1: Insert data into the property table
// //   const propertyQuery = `
// //     INSERT INTO property (
// //       serial_number, scheme_name, property_unique_id, allottee_name, fathers_husbands_name,
// //       permanent_address, current_address, mobile_number, property_category, property_number,
// //       registration_amount, registration_date, allotment_amount, allotment_date, sale_price,
// //       freehold_amount, lease_rent_amount, park_charge, corner_charge,
// //       remaining_sale_price_lump_sum, remaining_sale_price_installments, interest_amount,
// //       area_square_meter, possession_date, additional_land_amount, restoration_charges,
// //       certificate_charges, service_charges_financial_year, service_charges_amount,
// //       service_charges_late_fee, service_charges_date, registration_charges, registration_date_2,
// //       transfer_name, transferors_fathers_husbands_name, address, inheritance,
// //       transfer_fee, documentation_fee, transfer_date, building_plan_approval_date,
// //       building_construction, deposit_date, receipt_number, change_fee, advertisement_fee
// //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// //   const propertyValues = [
// //     formData["serialNumber"], formData["schemeName"], formData["propertyId"], formData["ownerName"],
// //     formData["fatherName"], formData["permanentAddress"], formData["currentAddress"],
// //     formData["mobileNumber"], formData["category"], formData["propertyNumber"],
// //     formData["registrationAmount"], formData["registrationDate"], formData["allotmentAmount"],
// //     formData["allotmentDate"], formData["salePrice"], formData["freeholdAmount"],
// //     formData["leaseRent"], formData["parkCharge"], formData["cornerCharge"],
// //     formData["remainingSalePrice"], formData["remainingInstallment"], formData["interestAmount"],
// //     formData["area_square_meter"], formData["possession_date"], formData["additional_land_amount"],
// //     formData["restoration_charges"], formData["certificate_charges"], formData["service_charges_financial_year"],
// //     formData["service_charges_amount"], formData["service_charges_late_fee"], formData["service_charges_date"],
// //     formData["registration_charges"], formData["registration_date_2"], formData["transfer_name"],
// //     formData["transferors_fathers_husbands_name"], formData["address"], formData["inheritance"],
// //     formData["transfer_fee"], formData["documentation_fee"], formData["transfer_date"],
// //     formData["building_plan_approval_date"], formData["building_construction"], formData["deposit_date"],
// //     formData["receipt_number"], formData["change_fee"], formData["advertisement_fee"]
// //   ];

// //   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
// //     if (err) {
// //       console.error("Error inserting property data:", err);
// //       return res.status(500).send("Error inserting property data into the database");
// //     }

// //     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

// //     // Step 2: Insert data into the installments table
// //     const installmentQuery = `
// //       INSERT INTO installments (
// //         property_id, installment_payment_amount, installment_interest_amount, delayed_interest_amount, installment_date
// //       ) VALUES (?, ?, ?, ?, ?)`;

// //     // Use a loop to iterate over the paymentHistory array
// //     const installmentPromises = paymentHistory.map((installment) => {
// //       const installmentValues = [
// //         propertyId,
// //         installment.installmentAmount,
// //         installment.installmentInterest,
// //         installment.delayedInterestAmount,
// //         installment.installmentDate
// //       ];

// //       return new Promise((resolve, reject) => {
// //         pool.query(installmentQuery, installmentValues, (err, result) => {
// //           if (err) {
// //             console.error("Error inserting installment data:", err);
// //             reject(err);
// //           } else {
// //             resolve(result);
// //           }
// //         });
// //       });
// //     });

// //     Promise.all(installmentPromises)
// //       .then(() => {
// //         res.status(200).json({
// //           message: "Data inserted successfully",
// //           propertyData: formData,
// //           paymentHistory
// //         });
// //       })
// //       .catch((err) => {
// //         console.error("Error inserting installments:", err);
// //         res.status(500).send("Error inserting installments into the database");
// //       });
// //   });
// // });

// // // router.post('/', generatePropertyUniqueId, (req, res) => {
// // //   const formData = req.body; // This contains the form data as an object

// // //   // Step 1: Insert data into the property table
// // //   const propertyQuery = `
// // //     INSERT INTO property (
// // //       serial_number,
// // //       scheme_name,
// // //       property_unique_id,
// // //       allottee_name,
// // //       fathers_husbands_name,
// // //       permanent_address,
// // //       current_address,
// // //       mobile_number,
// // //       property_category,
// // //       property_number,
// // //       registration_amount,
// // //       registration_date,
// // //       allotment_amount,
// // //       allotment_date,
// // //       sale_price,
// // //       freehold_amount,
// // //       lease_rent_amount,
// // //       park_charge,
// // //       corner_charge,
// // //       remaining_sale_price_lump_sum,
// // //       remaining_sale_price_installments,
// // //       interest_amount,
// // //       area_square_meter,
// // //       possession_date,
// // //       additional_land_amount,
// // //       restoration_charges,
// // //       certificate_charges,
// // //       service_charges_financial_year,
// // //       service_charges_amount,
// // //       service_charges_late_fee,
// // //       service_charges_date,
// // //       registration_charges,
// // //       registration_date_2,
// // //       transfer_name,
// // //       transferors_fathers_husbands_name,
// // //       address,
// // //       inheritance,
// // //       transfer_fee,
// // //       documentation_fee,
// // //       transfer_date,
// // //       building_plan_approval_date,
// // //       building_construction,
// // //       deposit_date,
// // //       receipt_number,
// // //       change_fee,
// // //       advertisement_fee
// // //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// // //   const propertyValues = [
// // //     formData["serialNumber"],
// // //     formData["schemeName"],
// // //     formData["propertyId"],
// // //     formData["ownerName"],
// // //     formData["fatherName"],
// // //     formData["permanentAddress"],
// // //     formData["currentAddress"],
// // //     formData["mobileNumber"],
// // //     formData["category"],
// // //     formData["propertyNumber"],
// // //     formData["registrationAmount"],
// // //     formData["registrationDate"],
// // //     formData["allotmentAmount"],
// // //     formData["allotmentDate"],
// // //     formData["salePrice"],
// // //     formData["freeholdAmount"],
// // //     formData["leaseRent"],
// // //     formData["parkCharge"],
// // //     formData["cornerCharge"],
// // //     formData["remainingSalePrice"],
// // //     formData["remainingInstallment"],
// // //     formData["interestAmount"],
// // //     formData["area_square_meter"],
// // //     formData["possession_date"],
// // //     formData["additional_land_amount"],
// // //     formData["restoration_charges"],
// // //     formData["certificate_charges"],
// // //     formData["service_charges_financial_year"],
// // //     formData["service_charges_amount"],
// // //     formData["service_charges_late_fee"],
// // //     formData["service_charges_date"],
// // //     formData["registration_charges"],
// // //     formData["registration_date_2"],
// // //     formData["transfer_name"],
// // //     formData["transferors_fathers_husbands_name"],
// // //     formData["address"],
// // //     formData["inheritance"],
// // //     formData["transfer_fee"],
// // //     formData["documentation_fee"],
// // //     formData["transfer_date"],
// // //     formData["building_plan_approval_date"],
// // //     formData["building_construction"],
// // //     formData["deposit_date"],
// // //     formData["receipt_number"],
// // //     formData["change_fee"],
// // //     formData["advertisement_fee"]
// // //   ];

// // //   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
// // //     if (err) {
// // //       console.error("Error inserting property data:", err);
// // //       return res.status(500).send("Error inserting property data into the database");
// // //     }

// // //     const propertyId = propertyResult.insertId; // Get the ID of the inserted property

// // //     // Step 2: Insert data into the installments table
// // //     const installmentQuery = `
// // //       INSERT INTO installments (
// // //         property_id,
// // //         installment_payment_amount,
// // //         installment_interest_amount,
// // //         delayed_interest_amount,
// // //         installment_date
// // //       ) VALUES (?, ?, ?, ?, ?)`;

// // //     const installmentValues = [
// // //       propertyId,
// // //       formData["installmentAmount"],
// // //       formData["installmentInterest"],
// // //       formData["delayed_interest_amount"],
// // //       formData["installmentDate"] // Ensure this field exists in your formData
// // //     ];

// // //     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
// // //       if (err) {
// // //         console.error("Error inserting installment data:", err);
// // //         return res.status(500).send("Error inserting installment data into the database");
// // //       }

// // //       // Step 3: Insert data into the service_charge table
// // //       const serviceChargeQuery = `
// // //         INSERT INTO service_charge (
// // //           property_id,
// // //           service_charge_financial_year,
// // //           service_charge_amount,
// // //           service_charges_late_fee,
// // //           service_charges_date
// // //         ) VALUES (?, ?, ?, ?, ?)`;

// // //       const serviceChargeValues = [
// // //         propertyId,
// // //         formData["serviceChargeFinancialYear"],
// // //         formData["serviceChargeAmount"],
// // //         formData["serviceChargesLateFee"],
// // //         formData["serviceChargesDate"] // Ensure this field exists in your formData
// // //       ];

// // //       pool.query(serviceChargeQuery, serviceChargeValues, (err, serviceChargeResult) => {
// // //         if (err) {
// // //           console.error("Error inserting service charge data:", err);
// // //           return res.status(500).send("Error inserting service charge data into the database");
// // //         }

// // //         res.status(200).json({
// // //           message: "Data inserted successfully",
// // //           propertyData: formData,
// // //           installmentData: {
// // //             installmentAmount: formData["installmentAmount"],
// // //             installmentInterest: formData["installmentInterest"],
// // //             delayedInterest: formData["delayed_interest_amount"],
// // //             installmentDate: formData["installmentDate"]
// // //           },
// // //           serviceChargeData: {
// // //             serviceChargeFinancialYear: formData["serviceChargeFinancialYear"],
// // //             serviceChargeAmount: formData["serviceChargeAmount"],
// // //             serviceChargesLateFee: formData["serviceChargesLateFee"],
// // //             serviceChargesDate: formData["serviceChargesDate"]
// // //           }
// // //         });
// // //       });
// // //     });
// // //   });
// // // });




// // // const createInstallmentsTable = `
// // //   CREATE TABLE IF NOT EXISTS installments (
// // //     id INT AUTO_INCREMENT PRIMARY KEY,
// // //     property_id INT NOT NULL, -- Foreign key to link with property table
// // //     installment_payment_amount DECIMAL(10,2),
// // //     installment_interest_amount DECIMAL(10,2),
// // //     delayed_interest_amount DECIMAL(10,2),
// // //     installment_date DATE,
// // //     FOREIGN KEY (property_id) REFERENCES property(id) ON DELETE CASCADE
// // //   );
// // // `;

// // // // Execute this query once when setting up the database
// // // pool.query(createInstallmentsTable, (err) => {
// // //   if (err) {
// // //     console.error("Error creating installments table:", err);
// // //   } else {
// // //     console.log("Installments table created successfully.");
// // //   }
// // // });


// // // router.post('/', generatePropertyUniqueId, (req, res) => {
// // //   const formData = req.body; // This contains the form data as an object

// // //   // Insert data into the property table
// // //   const propertyQuery = `
// // //     INSERT INTO property (
// // //       serial_number,
// // //       scheme_name,
// // //       property_unique_id,
// // //       allottee_name,
// // //       fathers_husbands_name,
// // //       permanent_address,
// // //       current_address,
// // //       mobile_number,
// // //       property_category,
// // //       property_number,
// // //       registration_amount,
// // //       registration_date,
// // //       allotment_amount,
// // //       allotment_date,
// // //       sale_price,
// // //       freehold_amount,
// // //       lease_rent_amount,
// // //       park_charge,
// // //       corner_charge,
// // //       remaining_sale_price_lump_sum,
// // //       remaining_sale_price_installments,
// // //       interest_amount,
// // //       area_square_meter,
// // //       possession_date,
// // //       additional_land_amount,
// // //       restoration_charges,
// // //       certificate_charges,
// // //       service_charges_financial_year,
// // //       service_charges_amount,
// // //       service_charges_late_fee,
// // //       service_charges_date,
// // //       registration_charges,
// // //       registration_date_2,
// // //       transfer_name,
// // //       transferors_fathers_husbands_name,
// // //       address,
// // //       inheritance,
// // //       transfer_fee,
// // //       documentation_fee,
// // //       transfer_date,
// // //       building_plan_approval_date,
// // //       building_construction,
// // //       deposit_date,
// // //       receipt_number,
// // //       change_fee,
// // //       advertisement_fee
// // //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// // //   const propertyValues = [
// // //     formData["serialNumber"],
// // //     formData["schemeName"],
// // //     formData["propertyId"],
// // //     formData["ownerName"],
// // //     formData["fatherName"],
// // //     formData["permanentAddress"],
// // //     formData["currentAddress"],
// // //     formData["mobileNumber"],
// // //     formData["category"],
// // //     formData["propertyNumber"],
// // //     formData["registrationAmount"],
// // //     formData["registrationDate"],
// // //     formData["allotmentAmount"],
// // //     formData["allotmentDate"],
// // //     formData["salePrice"],
// // //     formData["freeholdAmount"],
// // //     formData["leaseRent"],
// // //     formData["parkCharge"],
// // //     formData["cornerCharge"],
// // //     formData["remainingSalePrice"],
// // //     formData["remainingInstallment"],
// // //     formData["interestAmount"],
// // //     formData["area_square_meter"],
// // //     formData["possession_date"],
// // //     formData["additional_land_amount"],
// // //     formData["restoration_charges"],
// // //     formData["certificate_charges"],
// // //     formData["service_charges_financial_year"],
// // //     formData["service_charges_amount"],
// // //     formData["service_charges_late_fee"],
// // //     formData["service_charges_date"],
// // //     formData["registration_charges"],
// // //     formData["registration_date_2"],
// // //     formData["transfer_name"],
// // //     formData["transferors_fathers_husbands_name"],
// // //     formData["address"],
// // //     formData["inheritance"],
// // //     formData["transfer_fee"],
// // //     formData["documentation_fee"],
// // //     formData["transfer_date"],
// // //     formData["building_plan_approval_date"],
// // //     formData["building_construction"],
// // //     formData["deposit_date"],
// // //     formData["receipt_number"],
// // //     formData["change_fee"],
// // //     formData["advertisement_fee"]
// // //   ];

// // //   pool.query(propertyQuery, propertyValues, (err, propertyResult) => {
// // //     if (err) {
// // //       console.error("Error inserting property data:", err);
// // //       return res.status(500).send("Error inserting property data into the database");
// // //     }

// // //     const propertyId = propertyResult.insertId; // Get the ID of the inserted property
// // //     console.log(propertyId);
    
// // //     // Insert data into the installments table
// // //     const installmentQuery = `
// // //       INSERT INTO installments (
// // //         property_id,
// // //         installment_payment_amount,
// // //         installment_interest_amount,
// // //         delayed_interest_amount,
// // //         installment_date
// // //       ) VALUES (?, ?, ?, ?, ?)
// // //     `;

// // //     const installmentValues = [
// // //       propertyId,
// // //       formData["installmentAmount"],
// // //       formData["installmentInterest"],
// // //       formData["delayed_interest_amount"],
// // //       formData["installmentDate"] // Ensure this field exists in your formData
// // //     ];

// // //     pool.query(installmentQuery, installmentValues, (err, installmentResult) => {
// // //       if (err) {
// // //         console.error("Error inserting installment data:", err);
// // //         return res.status(500).send("Error inserting installment data into the database");
// // //       }

// // //       res.status(200).json({
// // //         message: "Data inserted successfully",
// // //         propertyData: formData,
// // //         installmentData: {
// // //           installmentAmount: formData["installmentAmount"],
// // //           installmentInterest: formData["installmentInterest"],
// // //           delayedInterest: formData["delayed_interest_amount"],
// // //           installmentDate: formData["installmentDate"]
// // //         }
// // //       });
// // //     });
// // //   });
// // // });




// // // old post request
// // // // POST route to insert form data into the database
// // // router.post('/', generatePropertyUniqueId, (req, res) => {
// // //   const formData = req.body; // This contains the form data as an object
// // //   console.log(formData);  // Log form data to verify


// // //   // Construct SQL query to insert form data
// // // //   make sure query and values are same.
// // //   const query = `
// // //     INSERT INTO property (
// // //       serial_number,
// // //        scheme_name,
// // //         property_unique_id,
// // //          allottee_name,
// // //           fathers_husbands_name,
// // //            permanent_address,
// // //       current_address,
// // //        mobile_number,
// // //         property_category,
// // //          property_number,
// // //           registration_amount,
// // //            registration_date,
// // //       allotment_amount,
// // //        allotment_date,
// // //         sale_price,
// // //          freehold_amount,
// // //           lease_rent_amount,
// // //            park_charge,
// // //             corner_charge,
// // //       remaining_sale_price_lump_sum,
// // //        remaining_sale_price_installments,
// // //         interest_amount,
// // //          installment_payment_amount,
// // //       installment_interest_amount,
// // //        delayed_interest_amount,
// // //         area_square_meter,
// // //          possession_date,
// // //           additional_land_amount,
// // //       restoration_charges,
// // //        certificate_charges,
// // //         service_charges_financial_year,
// // //          service_charges_amount,
// // //           service_charges_late_fee,
// // //       service_charges_date,
// // //        registration_charges,
// // //         registration_date_2,
// // //          transfer_name,
// // //           transferors_fathers_husbands_name,
// // //            address,
// // //       inheritance,
// // //        transfer_fee,
// // //         documentation_fee,
// // //          transfer_date,
// // //           building_plan_approval_date,
// // //            building_construction,
// // //       deposit_date,
// // //        receipt_number,
// // //         change_fee,
// // //          advertisement_fee
// // //     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// // //   const values = [
// // //     formData["serialNumber"],
// // //      formData["schemeName"], 
// // //      formData["propertyId"],
// // //       formData["ownerName"], 
// // //     formData["fatherName"],
// // //      formData["permanentAddress"],
// // //       formData["currentAddress"],
// // //        formData["mobileNumber"],
// // //     formData["category"],
// // //      formData["propertyNumber"],
// // //       formData["registrationAmount"],
// // //        formData["registrationDate"],
// // //     formData["allotmentAmount"],
// // //      formData["allotmentDate"],
// // //       formData["salePrice"],
// // //        formData["freeholdAmount"], 
// // //        formData["leaseRent"],
// // //     formData["parkCharge"],
// // //      formData["cornerCharge"],
// // //       formData["remainingSalePrice"],
// // //        formData["remainingInstallment"],
// // //     formData["interestAmount"],
// // //      formData["installmentAmount"],
// // //       formData["installmentInterest"],
// // //        formData["delayed_interest_amount"],
// // //     formData["area_square_meter"],
// // //      formData["possession_date"],
// // //       formData["additional_land_amount"],
// // //        formData["restoration_charges"],
// // //     formData["certificate_charges"],
// // //      formData["service_charges_financial_year"],
// // //       formData["service_charges_amount"],
// // //        formData["service_charges_late_fee"],
// // //     formData["service_charges_date"],
// // //      formData["registration_charges"],
// // //       formData["registration_date_2"],
// // //        formData["transfer_name"],
// // //     formData["transferors_fathers_husbands_name"],
// // //      formData["address"],
// // //       formData["inheritance"],
// // //        formData["transfer_fee"],
// // //         formData["documentation_fee"],
// // //     formData["transfer_date"],
// // //      formData["building_plan_approval_date"],
// // //       formData["building_construction"],
// // //        formData["deposit_date"],
// // //     formData["receipt_number"],
// // //      formData["change_fee"],
// // //       formData["advertisement_fee"]
// // //   ];


  

// // //   // Execute the SQL query
// // //   pool.query(query, values, (err, result) => {
// // //     if (err) {
// // //       console.error('Error inserting data:', err);
// // //       return res.status(500).send('Error inserting data into the database');
// // //     }
// // //     res.status(200).json({message:'Data inserted successfully' , data: formData});
// // //   });
// // // });

// // // GET route to fetch all data from the property table--




// // router.get('/', (req, res) => {
// //     const query = 'SELECT * FROM property';
  
// //     pool.query(query, (err, results) => {
// //       if (err) {
// //         console.error('Error fetching data:', err);
// //         return res.status(500).send('Error fetching data from the database');
// //       }
  
// //       res.status(200).json({
// //         message: 'Data fetched successfully',
// //         data: results,
// //       });
// //     });
// //   });

// // module.exports = router;
